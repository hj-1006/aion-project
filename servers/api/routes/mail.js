import express from 'express';
import fs from 'fs';
import path from 'path';
import * as mailService from '../services/mailService.js';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

const DEBUG_LOG = '/tmp/debug-mail.log';
function debugLog(obj) {
  try { fs.appendFileSync(DEBUG_LOG, JSON.stringify(obj) + '\n'); } catch (_) {}
}

router.use((req, res, next) => {
  debugLog({ location: 'api/mail router', message: 'any mail route hit', data: { method: req.method, path: req.path }, timestamp: Date.now() });
  next();
});

/** 메일 발송 (내부망 SMTP) + DB 저장 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    const from = (req.session && req.session.user && req.session.user.email) ? req.session.user.email : undefined;
    const result = await mailService.sendMail({ to, subject, text, html, from });
    if (result.success) {
      const toStr = Array.isArray(to) ? to.join(', ') : String(to);
      const fromStr = (from && from.trim()) || process.env.MAIL_FROM || process.env.SMTP_USER || 'aion@localhost';
      try {
        await queryClient.insertMailLog({
          direction: 'sent',
          from_address: fromStr,
          to_address: toStr,
          subject: subject || '',
          body_text: text != null ? String(text) : null,
          body_html: html != null ? String(html) : null
        });
      } catch (e) {
        logger.warn('Mail log save failed (sent mail may not appear in mailbox): ' + (e.message || e));
      }
      return res.json({ success: true, message: result.message });
    }
    return res.status(400).json({ success: false, message: result.message });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || '메일 발송 중 오류' });
  }
});

/** SMTP 설정 상태 확인 */
router.get('/status', (req, res) => {
  const { transporter, error } = mailService.getTransporter();
  res.json({
    success: true,
    configured: !!transporter,
    message: transporter ? 'SMTP 설정됨' : (error || 'SMTP 미설정')
  });
});

function isMailSentByUser(row, userEmail) {
  if (!userEmail || !row) return false;
  const email = String(userEmail).trim().toLowerCase();
  const from = String(row.from_address || '').trim().toLowerCase();
  return from === email;
}

function isMailForUser(row, userEmail) {
  if (!userEmail || !row) return false;
  const email = String(userEmail).trim().toLowerCase();
  const from = String(row.from_address || '').trim().toLowerCase();
  if (from === email) return true;
  const toStr = String(row.to_address || '').trim().toLowerCase();
  const toList = toStr.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  return toList.some(addr => addr === email);
}

function handleMailList(req, res) {
  debugLog({ location: 'api/routes/mail.js:list', message: 'GET list handler entered', data: { query: req.query }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' });
  (async () => {
    try {
      const userEmail = (req.session && req.session.user && req.session.user.email) ? req.session.user.email : null;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      const search = (req.query.search || '').trim();

      let list = [];

      const tableData = await queryClient.getDbTable('mail_log', { limit: 1000, offset: 0 });
      const tableRows = (tableData && tableData.rows) || [];
      debugLog({ location: 'api/routes/mail.js:list', message: 'getDbTable result', data: { rows: tableRows.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' });

      if (tableRows.length > 0) {
        list = tableRows;
      } else {
        const mailLogData = await queryClient.getMailLogList({ search, limit: 1000, offset: 0 });
        list = (mailLogData && mailLogData.list) || [];
      }

      if (search) {
        const term = search.toLowerCase();
        list = list.filter(row => {
          const sub = String(row.subject || '').toLowerCase();
          const body = String(row.body_text || '').toLowerCase();
          const from = String(row.from_address || '').toLowerCase();
          const to = String(row.to_address || '').toLowerCase();
          return sub.includes(term) || body.includes(term) || from.includes(term) || to.includes(term);
        });
      }

      let sent = [];
      let received = [];
      if (userEmail) {
        const email = String(userEmail).trim().toLowerCase();
        list.forEach(row => {
          const from = String(row.from_address || '').trim().toLowerCase();
          const toStr = String(row.to_address || '').trim().toLowerCase();
          const toList = toStr.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
          const isSent = from === email;
          const isReceived = toList.some(addr => addr === email);
          if (isSent) sent.push(row);
          if (isReceived) received.push(row);
        });
        sent.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        received.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
      const sentTotal = sent.length;
      const receivedTotal = received.length;
      const folder = (req.query.folder || '').toLowerCase();
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageLimit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);

      if (folder === 'sent' || folder === 'received') {
        const listData = folder === 'sent' ? sent : received;
        const total = folder === 'sent' ? sentTotal : receivedTotal;
        const start = (page - 1) * pageLimit;
        const pagedList = listData.slice(start, start + pageLimit);
        return res.json({ success: true, list: pagedList, total, page, limit: pageLimit, folder });
      }

      sent = sent.slice(offset, offset + limit);
      received = received.slice(offset, offset + limit);
      res.json({ success: true, sent, received, sentTotal, receivedTotal, limit, offset });
    } catch (err) {
      debugLog({ location: 'api/routes/mail.js:list', message: 'list handler error', data: { err: err.message }, timestamp: Date.now(), sessionId: 'debug-session' });
      res.status(500).json({ success: false, message: err.message || '목록 조회 실패' });
    }
  })();
}
router.get('/list', handleMailList);
router.get('/inbox', handleMailList);

/** 메일함 상세 — 숫자 id만 매칭. 본인 메일만 허용 */
router.get('/:id(\\d+)', async (req, res) => {
  debugLog({ location: 'api/routes/mail.js/:id', message: 'GET /:id handler entered', data: { id: req.params.id }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' });
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const data = await queryClient.getMailLogById(id);
    if (!data || !data.item) return res.status(404).json({ success: false, message: 'Not found' });
    const userEmail = (req.session && req.session.user && req.session.user.email) ? req.session.user.email : null;
    if (!userEmail || !isMailForUser(data.item, userEmail)) return res.status(404).json({ success: false, message: 'Not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || '상세 조회 실패' });
  }
});

export default router;

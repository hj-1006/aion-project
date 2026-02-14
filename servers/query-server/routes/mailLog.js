import express from 'express';
import fs from 'fs';
import path from 'path';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

const DEBUG_LOG = '/tmp/debug-mail.log';
function debugLog(obj) {
  try { fs.appendFileSync(DEBUG_LOG, JSON.stringify(obj) + '\n'); } catch (_) {}
}

/** 목록 + 검색 (search=키워드, limit, offset) */
router.get('/', async (req, res) => {
  debugLog({ location: 'query-server/mailLog.js:GET/', message: 'mail-log list handler entered', data: { query: req.query }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' });
  try {
    const search = (req.query.search || '').trim().replace(/%/g, '\\%');
    const limitNum = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offsetNum = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const limit = Number.isInteger(limitNum) ? limitNum : 50;
    const offset = Number.isInteger(offsetNum) ? offsetNum : 0;

    let listSql = 'SELECT id, direction, from_address, to_address, subject, created_at FROM mail_log';
    let countSql = 'SELECT COUNT(*) AS total FROM mail_log';
    const params = [];
    const countParams = [];

    if (search) {
      const like = '%' + search + '%';
      const where = ' WHERE (subject LIKE ? OR body_text LIKE ? OR from_address LIKE ? OR to_address LIKE ?)';
      listSql += where;
      countSql += where;
      params.push(like, like, like, like);
      countParams.push(like, like, like, like);
    }

    listSql += ' ORDER BY created_at DESC LIMIT ' + String(limit) + ' OFFSET ' + String(offset);

    const [rows, countRows] = await Promise.all([
      db.query(listSql, params),
      db.query(countSql, countParams)
    ]);
    const total = countRows[0]?.total ?? 0;
    debugLog({ location: 'query-server/mailLog.js:GET/', message: 'mail-log list result', data: { rowsLength: Array.isArray(rows) ? rows.length : -1, total, countRowsIsArray: Array.isArray(countRows) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' });

    res.json({ success: true, list: rows || [], total, limit, offset });
  } catch (err) {
    logger.error('mailLog GET: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 상세 (본문 포함) */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const rows = await db.query(
      'SELECT id, direction, from_address, to_address, subject, body_text, body_html, created_at FROM mail_log WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, item: rows[0] });
  } catch (err) {
    logger.error('mailLog GET /:id: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 저장 (보낸/받은 메일 기록) */
router.post('/', async (req, res) => {
  try {
    const { direction, from_address, to_address, subject, body_text, body_html } = req.body || {};
    const dir = (direction === 'received') ? 'received' : 'sent';
    await db.query(
      'INSERT INTO mail_log (direction, from_address, to_address, subject, body_text, body_html) VALUES (?, ?, ?, ?, ?, ?)',
      [
        dir,
        (from_address || '').trim() || '',
        (to_address || '').trim() || '',
        (subject || '').trim() || '',
        body_text != null ? String(body_text) : null,
        body_html != null ? String(body_html) : null
      ]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('mailLog POST: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

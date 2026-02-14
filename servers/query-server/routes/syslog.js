import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

router.post('/events', async (req, res) => {
  try {
    const { asset_id, severity, facility, message, raw, host_from } = req.body || {};
    await db.query(
      'INSERT INTO syslog_events (asset_id, severity, facility, message, raw, host_from) VALUES (?, ?, ?, ?, ?, ?)',
      [asset_id || null, severity || null, facility || null, message || null, raw || null, host_from || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('syslog POST /events: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

function toFilterValue(val) {
  if (val === undefined || val === null || val === '') return null;
  if (String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') return null;
  return val;
}

router.get('/events', async (req, res) => {
  try {
    const limitNum = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const severity = toFilterValue(req.query.severity);
    const assetIdRaw = toFilterValue(req.query.asset_id);
    const assetId = assetIdRaw != null && /^\d+$/.test(String(assetIdRaw)) ? parseInt(assetIdRaw, 10) : null;
    let sql = 'SELECT e.id, e.asset_id, e.severity, e.facility, e.message, e.raw, e.host_from, e.received_at, a.device_id FROM syslog_events e LEFT JOIN assets a ON e.asset_id = a.id WHERE 1=1';
    const params = [];
    if (severity != null) { sql += ' AND e.severity = ?'; params.push(severity); }
    if (assetId != null) { sql += ' AND e.asset_id = ?'; params.push(assetId); }
    sql += ' ORDER BY e.received_at DESC LIMIT ' + limitNum;
    const rows = await db.query(sql, params.length ? params : undefined);
    res.json({ success: true, events: rows });
  } catch (err) {
    logger.error('syslog GET /events: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/events/count', async (req, res) => {
  try {
    const [row] = await db.query('SELECT COUNT(*) AS cnt FROM syslog_events');
    res.json({ success: true, count: row?.cnt ?? 0 });
  } catch (err) {
    logger.error('syslog GET /events/count: ' + (err.message || err));
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import express from 'express';
import * as db from '../config/db.js';
const router = express.Router();

router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const severity = req.query.severity || null;
    const assetId = req.query.asset_id || null;
    let sql = 'SELECT e.id, e.asset_id, e.severity, e.facility, e.message, e.raw, e.host_from, e.received_at, a.device_id FROM syslog_events e LEFT JOIN assets a ON e.asset_id = a.id WHERE 1=1';
    const params = [];
    if (severity) { sql += ' AND e.severity = ?'; params.push(severity); }
    if (assetId) { sql += ' AND e.asset_id = ?'; params.push(assetId); }
    sql += ' ORDER BY e.received_at DESC LIMIT ?';
    params.push(limit);
    const rows = await db.query(sql, params);
    res.json({ success: true, events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/events/count', async (req, res) => {
  try {
    const [row] = await db.query('SELECT COUNT(*) AS cnt FROM syslog_events');
    res.json({ success: true, count: row?.cnt ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

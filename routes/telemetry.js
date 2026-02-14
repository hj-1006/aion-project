import express from 'express';
import * as db from '../config/db.js';
import logger from '../lib/logger.js';
const router = express.Router();

router.get('/snapshots', async (req, res) => {
  try {
    const assetId = req.query.asset_id || null;
    const metricType = req.query.metric_type || null;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    let sql = 'SELECT t.id, t.asset_id, t.metric_type, t.value_json, t.collected_at, a.device_id FROM telemetry_snapshots t JOIN assets a ON t.asset_id = a.id WHERE 1=1';
    const params = [];
    if (assetId) { sql += ' AND t.asset_id = ?'; params.push(assetId); }
    if (metricType) { sql += ' AND t.metric_type = ?'; params.push(metricType); }
    sql += ' ORDER BY t.collected_at DESC LIMIT ?';
    params.push(limit);
    const rows = await db.query(sql, params);
    res.json({ success: true, snapshots: rows });
  } catch (err) {
    logger.error('telemetry GET /snapshots: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/assets', async (req, res) => {
  try {
    const rows = await db.query('SELECT id, device_id, type, location, role, ip FROM assets ORDER BY device_id');
    res.json({ success: true, assets: rows });
  } catch (err) {
    logger.error('telemetry GET /assets: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/snapshots/count', async (req, res) => {
  try {
    const [row] = await db.query('SELECT COUNT(*) AS cnt FROM telemetry_snapshots');
    res.json({ success: true, count: row?.cnt ?? 0 });
  } catch (err) {
    logger.error('telemetry GET /snapshots/count: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

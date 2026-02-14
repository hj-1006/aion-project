import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';

const router = express.Router();

function toFilterValue(val) {
  if (val === undefined || val === null || val === '') return null;
  if (String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') return null;
  return val;
}

router.get('/snapshots', async (req, res) => {
  try {
    const assetIdRaw = toFilterValue(req.query.asset_id);
    const assetId = assetIdRaw != null && /^\d+$/.test(String(assetIdRaw)) ? parseInt(assetIdRaw, 10) : null;
    const metricType = toFilterValue(req.query.metric_type);
    const limitNum = Math.min(500, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));
    let sql = 'SELECT t.id, t.asset_id, t.metric_type, t.value_json, t.collected_at, a.device_id FROM telemetry_snapshots t JOIN assets a ON t.asset_id = a.id WHERE 1=1';
    const params = [];
    if (assetId != null) { sql += ' AND t.asset_id = ?'; params.push(assetId); }
    if (metricType != null) { sql += ' AND t.metric_type = ?'; params.push(metricType); }
    sql += ' ORDER BY t.collected_at DESC LIMIT ' + String(limitNum);
    const rows = await db.query(sql, params.length ? params : undefined);
    res.json({ success: true, snapshots: rows });
  } catch (err) {
    logger.error('telemetry GET /snapshots: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/snapshots/count', async (req, res) => {
  try {
    const [row] = await db.query('SELECT COUNT(*) AS cnt FROM telemetry_snapshots');
    res.json({ success: true, count: row?.cnt ?? 0 });
  } catch (err) {
    logger.error('telemetry GET /snapshots/count: ' + (err.message || err));
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/snapshots', async (req, res) => {
  try {
    const { asset_id, metric_type, value_json } = req.body || {};
    if (!asset_id || !metric_type) {
      return res.status(400).json({ success: false, error: 'asset_id, metric_type required' });
    }
    const val = value_json !== undefined ? JSON.stringify(value_json) : null;
    await db.query(
      'INSERT INTO telemetry_snapshots (asset_id, metric_type, value_json) VALUES (?, ?, ?)',
      [asset_id, metric_type, val]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('telemetry POST /snapshots: ' + (err.message || err));
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

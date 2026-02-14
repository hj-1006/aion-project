import express from 'express';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
import { getRecentLogs } from '../services/telemetryCollector.js';

const router = express.Router();

router.get('/collection-logs', (req, res) => {
  try {
    const logs = getRecentLogs(req.query.limit);
    res.json({ success: true, logs });
  } catch (err) {
    logger.error('telemetry GET /collection-logs: ' + (err.message || err));
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/snapshots', async (req, res) => {
  try {
    const params = { limit: req.query.limit, asset_id: req.query.asset_id, metric_type: req.query.metric_type };
    const snapshots = await queryClient.getTelemetrySnapshots(params);
    res.json({ success: true, snapshots });
  } catch (err) {
    logger.error('telemetry GET /snapshots: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/assets', async (req, res) => {
  try {
    const assets = await queryClient.getAssets();
    res.json({ success: true, assets });
  } catch (err) {
    logger.error('telemetry GET /assets: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/snapshots/count', async (req, res) => {
  try {
    const count = await queryClient.getTelemetrySnapshotsCount();
    res.json({ success: true, count });
  } catch (err) {
    logger.error('telemetry GET /snapshots/count: ' + (err.message || err), { path: req.path, stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

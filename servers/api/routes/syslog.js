import express from 'express';
import axios from 'axios';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

const EXTERNAL_SYSLOG_URL = process.env.EXTERNAL_SYSLOG_URL || '';

router.get('/events', async (req, res) => {
  try {
    if (EXTERNAL_SYSLOG_URL) {
      const base = EXTERNAL_SYSLOG_URL.replace(/\/$/, '');
      const q = new URLSearchParams(req.query).toString();
      const url = `${base}/events${q ? '?' + q : ''}`;
      const { data } = await axios.get(url, { timeout: 15000 });
      return res.json(data && typeof data.success !== 'undefined' ? data : { success: true, events: data.events || data });
    }
    const limit = req.query.limit || '100';
    const severity = req.query.severity || null;
    const assetId = req.query.asset_id || null;
    const events = await queryClient.getSyslogEvents({ limit, severity, asset_id: assetId });
    res.json({ success: true, events });
  } catch (err) {
    logger.error('syslog/events: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/events/count', async (req, res) => {
  try {
    if (EXTERNAL_SYSLOG_URL) {
      const base = EXTERNAL_SYSLOG_URL.replace(/\/$/, '');
      const url = `${base}/events/count`;
      const { data } = await axios.get(url, { timeout: 10000 });
      return res.json(data && typeof data.success !== 'undefined' ? data : { success: true, count: data.count != null ? data.count : 0 });
    }
    const count = await queryClient.getSyslogEventsCount();
    res.json({ success: true, count });
  } catch (err) {
    logger.error('syslog/events/count: ' + (err.message || err));
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

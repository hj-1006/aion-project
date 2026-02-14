import express from 'express';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

router.get('/tables', async (req, res) => {
  try {
    const tables = await queryClient.getDbTables();
    res.json({ success: true, tables });
  } catch (err) {
    logger.error('db GET /tables: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/table/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { limit, offset } = req.query;
    const data = await queryClient.getDbTable(name, { limit, offset });
    res.json(data);
  } catch (err) {
    logger.error('db GET /table/:name: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

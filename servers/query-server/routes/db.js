import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

const ALLOWED_TABLES = [
  'users', 'assets', 'vlans', 'services',
  'syslog_events', 'telemetry_snapshots', 'automation_logs',
  'mail_log', 'user_sessions', 'llm_queries'
];

function toFilterValue(val) {
  if (val === undefined || val === null || val === '') return null;
  if (String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') return null;
  return val;
}

router.get('/tables', async (req, res) => {
  try {
    const schema = process.env.MYSQL_DATABASE || 'aion';
    const placeholders = ALLOWED_TABLES.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT TABLE_NAME AS name, TABLE_ROWS AS rows_approx FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders}) ORDER BY TABLE_NAME`,
      [schema, ...ALLOWED_TABLES]
    );
    res.json({ success: true, tables: rows });
  } catch (err) {
    logger.error('db GET /tables: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/table/:name', async (req, res) => {
  try {
    const name = (req.params.name || '').replace(/[^a-z0-9_]/gi, '');
    if (!ALLOWED_TABLES.includes(name)) {
      return res.status(400).json({ success: false, error: '허용되지 않은 테이블입니다.' });
    }
    const limitRaw = toFilterValue(req.query.limit);
    const limitNum = (limitRaw != null && /^\d+$/.test(String(limitRaw))) ? Math.min(parseInt(limitRaw, 10), 1000) : 100;
    const offsetRaw = toFilterValue(req.query.offset);
    const offsetNum = (offsetRaw != null && /^\d+$/.test(String(offsetRaw))) ? Math.max(0, parseInt(offsetRaw, 10)) : 0;
    const [rows] = await db.pool.execute(
      `SELECT * FROM \`${name}\` LIMIT ${limitNum} OFFSET ${offsetNum}`
    );
    const [countRows] = await db.pool.execute(`SELECT COUNT(*) AS cnt FROM \`${name}\``);
    const total = (countRows && countRows[0]) ? Number(countRows[0].cnt) : 0;
    res.json({ success: true, rows, total, limit: limitNum, offset: offsetNum });
  } catch (err) {
    logger.error('db GET /table/:name: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

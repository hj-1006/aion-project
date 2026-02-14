import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      question,
      category,
      hostname,
      command_or_action,
      success,
      output_preview,
      summary,
      user_id,
      username
    } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'question(문자열) 필요' });
    }
    const cat = (category && String(category).trim()) || 'general';
    const preview = output_preview != null ? String(output_preview).slice(0, 8000) : null;
    await db.query(
      `INSERT INTO llm_queries (question, category, hostname, command_or_action, success, output_preview, summary, user_id, username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        question.slice(0, 65535),
        cat,
        hostname || null,
        command_or_action || null,
        success == null ? null : (success ? 1 : 0),
        preview,
        summary != null ? String(summary).slice(0, 65535) : null,
        user_id != null ? Number(user_id) : null,
        username != null ? String(username).slice(0, 64) : null
      ]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.status(201).json({ success: true });
    }
    logger.error('llm-queries POST: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category).trim() : null;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    let sql = 'SELECT id, question, category, hostname, command_or_action, success, output_preview, summary, user_id, username, created_at FROM llm_queries WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY created_at DESC LIMIT ' + limit;
    const rows = await db.query(sql, params);
    res.json({ success: true, queries: rows || [] });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.json({ success: true, queries: [] });
    }
    logger.error('llm-queries GET: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

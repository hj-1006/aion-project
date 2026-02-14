import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

function toBool(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return null;
}

router.get('/', async (req, res) => {
  try {
    const active = toBool(req.query.active);
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const username = req.query.username ? String(req.query.username).trim() : null;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '200', 10) || 200));
    let sql = 'SELECT id, session_id, user_id, username, login_ip, login_user_agent, login_at, last_seen_at, last_seen_ip, last_seen_user_agent, revoked_at, revoked_by, revoked_reason FROM user_sessions WHERE 1=1';
    const params = [];
    if (active === true) sql += ' AND revoked_at IS NULL';
    if (active === false) sql += ' AND revoked_at IS NOT NULL';
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (username) { sql += ' AND username = ?'; params.push(username); }
    sql += ' ORDER BY last_seen_at DESC LIMIT ' + limit;
    const rows = await db.query(sql, params);
    res.json({ success: true, sessions: rows || [] });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.json({ success: true, sessions: [] });
    }
    logger.error('sessions GET /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:session_id', async (req, res) => {
  try {
    const sid = String(req.params.session_id || '').trim();
    if (!sid) return res.status(400).json({ success: false, error: 'session_id required' });
    const rows = await db.query(
      'SELECT id, session_id, user_id, username, login_ip, login_user_agent, login_at, last_seen_at, last_seen_ip, last_seen_user_agent, revoked_at, revoked_by, revoked_reason FROM user_sessions WHERE session_id = ? LIMIT 1',
      [sid]
    );
    res.json({ success: true, session: rows && rows[0] ? rows[0] : null });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.json({ success: true, session: null });
    }
    logger.error('sessions GET /:id: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      user_id,
      username,
      login_ip,
      login_user_agent,
      login_at,
      last_seen_at,
      last_seen_ip,
      last_seen_user_agent
    } = req.body || {};
    if (!session_id || !user_id || !username) {
      return res.status(400).json({ success: false, error: 'session_id, user_id, username required' });
    }
    await db.query(
      `INSERT INTO user_sessions
       (session_id, user_id, username, login_ip, login_user_agent, login_at, last_seen_at, last_seen_ip, last_seen_user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_seen_at = VALUES(last_seen_at),
         last_seen_ip = VALUES(last_seen_ip),
         last_seen_user_agent = VALUES(last_seen_user_agent)`,
      [
        String(session_id),
        Number(user_id),
        String(username),
        login_ip || null,
        login_user_agent || null,
        login_at || null,
        last_seen_at || null,
        last_seen_ip || null,
        last_seen_user_agent || null
      ]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.status(201).json({ success: true });
    }
    logger.error('sessions POST /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:session_id', async (req, res) => {
  try {
    const sid = String(req.params.session_id || '').trim();
    if (!sid) return res.status(400).json({ success: false, error: 'session_id required' });
    const {
      last_seen_at,
      last_seen_ip,
      last_seen_user_agent,
      revoked_at,
      revoked_by,
      revoked_reason
    } = req.body || {};
    const updates = [];
    const params = [];
    if (last_seen_at !== undefined) { updates.push('last_seen_at = ?'); params.push(last_seen_at); }
    if (last_seen_ip !== undefined) { updates.push('last_seen_ip = ?'); params.push(last_seen_ip || null); }
    if (last_seen_user_agent !== undefined) { updates.push('last_seen_user_agent = ?'); params.push(last_seen_user_agent || null); }
    if (revoked_at !== undefined) { updates.push('revoked_at = ?'); params.push(revoked_at); }
    if (revoked_by !== undefined) { updates.push('revoked_by = ?'); params.push(revoked_by || null); }
    if (revoked_reason !== undefined) { updates.push('revoked_reason = ?'); params.push(revoked_reason || null); }
    if (!updates.length) return res.json({ success: true });
    params.push(sid);
    await db.query(`UPDATE user_sessions SET ${updates.join(', ')} WHERE session_id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.json({ success: true });
    }
    logger.error('sessions PATCH /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/revoke', async (req, res) => {
  try {
    const { session_id, user_id, username, revoked_by, revoked_reason } = req.body || {};
    if (!session_id && !user_id && !username) {
      return res.status(400).json({ success: false, error: 'session_id or user_id or username required' });
    }
    const now = new Date();
    let sql = 'UPDATE user_sessions SET revoked_at = ?, revoked_by = ?, revoked_reason = ? WHERE 1=1';
    const params = [now, revoked_by || null, revoked_reason || null];
    if (session_id) { sql += ' AND session_id = ?'; params.push(String(session_id)); }
    if (user_id) { sql += ' AND user_id = ?'; params.push(Number(user_id)); }
    if (username) { sql += ' AND username = ?'; params.push(String(username)); }
    await db.query(sql, params);
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes("doesn't exist")) {
      return res.json({ success: true });
    }
    logger.error('sessions POST /revoke: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

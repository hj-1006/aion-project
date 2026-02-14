import express from 'express';
import * as db from '../config/db.js';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT id, username, display_name, email, can_use_mail, role FROM users ORDER BY id'
    );
    res.json({ success: true, users: rows || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/count', async (req, res) => {
  try {
    const rows = await db.query('SELECT COUNT(*) AS cnt FROM users');
    res.json({ success: true, count: rows[0]?.cnt ?? 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/by-username/:username', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT id, username, password_hash, display_name, email, can_use_mail, role FROM users WHERE username = ?',
      [req.params.username]
    );
    if (rows.length === 0) return res.status(404).json({ success: false });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, password_hash, display_name, email, can_use_mail, role } = req.body || {};
    if (!username || !password_hash) {
      return res.status(400).json({ success: false, error: 'username, password_hash required' });
    }
    const useMail = can_use_mail === true || can_use_mail === 1 || String(can_use_mail) === '1';
    const allowedRoles = ['viewer', 'user', 'operator', 'admin'];
    const roleVal = (role && allowedRoles.includes(String(role).toLowerCase())) ? String(role).toLowerCase() : 'user';
    await db.query(
      'INSERT INTO users (username, password_hash, display_name, email, can_use_mail, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, password_hash, display_name || null, email || null, useMail ? 1 : 0, roleVal]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 계정 수정 (비밀번호 제외: display_name, email, can_use_mail, role) */
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid user id' });
    const { display_name, email, can_use_mail, role } = req.body || {};
    const useMail = can_use_mail === true || can_use_mail === 1 || String(can_use_mail) === '1';
    const allowedRoles = ['viewer', 'user', 'operator', 'admin'];
    const roleVal = (role !== undefined && role !== null && allowedRoles.includes(String(role).toLowerCase()))
      ? String(role).toLowerCase()
      : undefined;
    const updates = [];
    const values = [];
    if (display_name !== undefined) { updates.push('display_name = ?'); values.push((display_name || '').trim() || null); }
    if (email !== undefined) { updates.push('email = ?'); values.push((email || '').trim() || null); }
    if (can_use_mail !== undefined) { updates.push('can_use_mail = ?'); values.push(useMail ? 1 : 0); }
    if (roleVal !== undefined) { updates.push('role = ?'); values.push(roleVal); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    values.push(id);
    await db.query(
      'UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?',
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

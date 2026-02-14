import bcrypt from 'bcrypt';
import * as db from '../config/db.js';

const DEFAULT_ADMIN_PASSWORD = 'admin123';

async function ensureDefaultAdmin() {
  const users = await db.query('SELECT id FROM users LIMIT 1');
  if (users.length === 0) {
    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await db.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      ['admin', hash, 'AION Admin']
    );
    console.log('Default admin created (username: admin, password: admin123)');
  }
}

async function findByUsername(username) {
  const rows = await db.query('SELECT id, username, password_hash, display_name FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}

async function verifyPassword(username, password) {
  const user = await findByUsername(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? { id: user.id, username: user.username, display_name: user.display_name } : null;
}

export { ensureDefaultAdmin, findByUsername, verifyPassword };

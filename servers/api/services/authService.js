import bcrypt from 'bcrypt';
import * as queryClient from '../lib/queryClient.js';

const DEFAULT_ADMIN_PASSWORD = 'admin123';

async function ensureDefaultAdmin() {
  const count = await queryClient.getUsersCount();
  if (count === 0) {
    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await queryClient.insertUser('admin', hash, 'AION Admin', null, false, 'admin');
    console.log('Default admin created (username: admin, password: admin123)');
  }
}

async function findByUsername(username) {
  return queryClient.getUserByUsername(username);
}

async function verifyPassword(username, password) {
  const user = await findByUsername(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  const allowedRoles = ['viewer', 'user', 'operator', 'admin'];
  const rawRole = user.role != null ? String(user.role).trim().toLowerCase() : '';
  const role = allowedRoles.includes(rawRole) ? rawRole : 'user';
  return ok
    ? {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email || null,
        can_use_mail: !!(user.can_use_mail === 1 || user.can_use_mail === true),
        role
      }
    : null;
}

export { ensureDefaultAdmin, findByUsername, verifyPassword };

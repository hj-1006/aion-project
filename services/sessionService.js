import * as db from '../config/db.js';

const REVOKE_CHECK_MS = parseInt(process.env.SESSION_REVOKE_CHECK_MS || '5000', 10);
const ACTIVITY_UPDATE_MS = parseInt(process.env.SESSION_ACTIVITY_UPDATE_MS || '60000', 10);

const lastCheckBySession = new Map();
const lastActivityBySession = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip.replace('::ffff:', '');
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 1000);
}

function formatNow() {
  const d = new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function upsertSessionRow(sessionId, user, ip, ua, now) {
  await db.query(
    `INSERT INTO user_sessions
      (session_id, user_id, username, login_ip, login_user_agent, login_at, last_seen_at, last_seen_ip, last_seen_user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_seen_at = VALUES(last_seen_at),
       last_seen_ip = VALUES(last_seen_ip),
       last_seen_user_agent = VALUES(last_seen_user_agent)`,
    [
      sessionId,
      user.id,
      user.username,
      ip,
      ua,
      now,
      now,
      ip,
      ua
    ]
  );
}

async function updateSessionRow(sessionId, fields) {
  const updates = [];
  const params = [];
  if (fields.last_seen_at !== undefined) { updates.push('last_seen_at = ?'); params.push(fields.last_seen_at); }
  if (fields.last_seen_ip !== undefined) { updates.push('last_seen_ip = ?'); params.push(fields.last_seen_ip || null); }
  if (fields.last_seen_user_agent !== undefined) { updates.push('last_seen_user_agent = ?'); params.push(fields.last_seen_user_agent || null); }
  if (fields.revoked_at !== undefined) { updates.push('revoked_at = ?'); params.push(fields.revoked_at); }
  if (fields.revoked_by !== undefined) { updates.push('revoked_by = ?'); params.push(fields.revoked_by || null); }
  if (fields.revoked_reason !== undefined) { updates.push('revoked_reason = ?'); params.push(fields.revoked_reason || null); }
  if (!updates.length) return;
  params.push(sessionId);
  await db.query(`UPDATE user_sessions SET ${updates.join(', ')} WHERE session_id = ?`, params);
}

async function getSessionRow(sessionId) {
  const rows = await db.query('SELECT session_id, revoked_at FROM user_sessions WHERE session_id = ? LIMIT 1', [sessionId]);
  return rows[0] || null;
}

async function recordLogin(req, user) {
  if (!req.sessionID || !user) return;
  const now = formatNow();
  await upsertSessionRow(req.sessionID, user, getClientIp(req), getUserAgent(req), now);
}

async function recordLogout(req, reason = 'logout', revokedBy = null) {
  if (!req.sessionID) return;
  await updateSessionRow(req.sessionID, { revoked_at: formatNow(), revoked_by: revokedBy, revoked_reason: reason });
}

async function ensureActiveSession(req) {
  try {
    const sid = req.sessionID;
    const user = req.session?.user;
    if (!sid || !user) return { ok: true };
    const now = Date.now();
    const lastCheck = lastCheckBySession.get(sid) || 0;
    if (now - lastCheck >= REVOKE_CHECK_MS) {
      const sessionRow = await getSessionRow(sid);
      if (sessionRow && sessionRow.revoked_at) {
        return { ok: false, revoked: true };
      }
      lastCheckBySession.set(sid, now);
      if (!sessionRow) {
        await recordLogin(req, user);
      }
    }
    const lastActivity = lastActivityBySession.get(sid) || 0;
    if (now - lastActivity >= ACTIVITY_UPDATE_MS) {
      await updateSessionRow(sid, {
        last_seen_at: formatNow(),
        last_seen_ip: getClientIp(req),
        last_seen_user_agent: getUserAgent(req)
      });
      lastActivityBySession.set(sid, now);
    }
    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}

export { recordLogin, recordLogout, ensureActiveSession };

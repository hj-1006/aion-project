import * as queryClient from '../lib/queryClient.js';

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

async function recordLogin(req, user) {
  if (!req.sessionID || !user) return;
  const now = formatNow();
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  await queryClient.createSession({
    session_id: req.sessionID,
    user_id: user.id,
    username: user.username,
    login_ip: ip,
    login_user_agent: ua,
    login_at: now,
    last_seen_at: now,
    last_seen_ip: ip,
    last_seen_user_agent: ua
  });
}

async function recordLogout(req, reason = 'logout', revokedBy = null) {
  if (!req.sessionID) return;
  const now = formatNow();
  await queryClient.updateSession(req.sessionID, {
    revoked_at: now,
    revoked_by: revokedBy,
    revoked_reason: reason
  });
}

async function ensureActiveSession(req) {
  try {
    const sid = req.sessionID;
    const user = req.session?.user;
    if (!sid || !user) return { ok: true };
    const now = Date.now();
    const lastCheck = lastCheckBySession.get(sid) || 0;
    if (now - lastCheck >= REVOKE_CHECK_MS) {
      const sessionRow = await queryClient.getSession(sid);
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
      await queryClient.updateSession(sid, {
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

import axios from 'axios';

const BASE_URL = (process.env.QUERY_SERVER_URL || 'http://localhost:3002').replace(/\/$/, '');
const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

async function get(path) {
  const res = await client.get(path);
  return res.data;
}

async function post(path, data) {
  const res = await client.post(path, data);
  return res.data;
}

async function patch(path, data) {
  const res = await client.patch(path, data);
  return res.data;
}

async function del(path) {
  const res = await client.delete(path);
  return res.data;
}

async function getUsers() {
  const data = await get('/users');
  return data.users || [];
}

async function getUsersCount() {
  const data = await get('/users/count');
  return data.count ?? 0;
}

async function getUserByUsername(username) {
  try {
    return await get(`/users/by-username/${encodeURIComponent(username)}`);
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

async function insertUser(username, password_hash, display_name, email, can_use_mail, role) {
  const body = { username, password_hash, display_name: display_name || null };
  if (email !== undefined) body.email = email || null;
  if (can_use_mail !== undefined) body.can_use_mail = !!can_use_mail;
  if (role !== undefined && ['viewer', 'user', 'operator', 'admin'].includes(String(role))) body.role = role;
  return post('/users', body);
}

async function updateUser(id, data) {
  const body = {};
  if (data.display_name !== undefined) body.display_name = data.display_name;
  if (data.email !== undefined) body.email = data.email;
  if (data.can_use_mail !== undefined) body.can_use_mail = !!data.can_use_mail;
  if (data.role !== undefined && ['viewer', 'user', 'operator', 'admin'].includes(String(data.role))) body.role = data.role;
  return patch('/users/' + encodeURIComponent(id), body);
}

async function getAssets() {
  const data = await get('/assets');
  return data.assets || [];
}

async function insertAsset(body) {
  return post('/assets', body);
}

async function updateAsset(id, body) {
  return patch('/assets/' + encodeURIComponent(id), body);
}

async function deleteAsset(id) {
  return del('/assets/' + encodeURIComponent(id));
}

async function getAssetsForTelemetry() {
  const data = await get('/assets/list-for-telemetry');
  return data.assets || [];
}

async function postSyslogEvent(body) {
  return post('/syslog/events', body);
}

async function getSyslogEvents(params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await get(`/syslog/events?${q}`);
  return data.events || [];
}

async function getSyslogEventsCount() {
  const data = await get('/syslog/events/count');
  return data.count ?? 0;
}

async function getTelemetrySnapshots(params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await get(`/telemetry/snapshots?${q}`);
  return data.snapshots || [];
}

async function getTelemetrySnapshotsCount() {
  const data = await get('/telemetry/snapshots/count');
  return data.count ?? 0;
}

async function postTelemetrySnapshot(asset_id, metric_type, value_json) {
  return post('/telemetry/snapshots', { asset_id, metric_type, value_json });
}

async function getDbTables() {
  const data = await get('/db/tables');
  return data.tables || [];
}

async function getDbTable(name, params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await get(`/db/table/${encodeURIComponent(name)}?${q}`);
  return data;
}

async function getMailLogList(params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await get(`/mail-log?${q}`);
  return data;
}

async function getMailLogById(id) {
  try {
    return await get(`/mail-log/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

async function insertMailLog(body) {
  return post('/mail-log', body);
}

async function createSession(body) {
  return post('/sessions', body);
}

async function updateSession(sessionId, body) {
  return patch('/sessions/' + encodeURIComponent(sessionId), body);
}

async function getSession(sessionId) {
  const data = await get('/sessions/' + encodeURIComponent(sessionId));
  return data.session || null;
}

async function getSessions(params = {}) {
  const q = new URLSearchParams(params).toString();
  const data = await get(`/sessions?${q}`);
  return data.sessions || [];
}

async function revokeSessions(body) {
  return post('/sessions/revoke', body);
}

async function insertLlmQuery(body) {
  return post('/llm-queries', body);
}

export {
  getUsers,
  getUsersCount,
  getUserByUsername,
  insertUser,
  updateUser,
  getAssets,
  getAssetsForTelemetry,
  insertAsset,
  updateAsset,
  deleteAsset,
  postSyslogEvent,
  getSyslogEvents,
  getSyslogEventsCount,
  getTelemetrySnapshots,
  getTelemetrySnapshotsCount,
  postTelemetrySnapshot,
  getDbTables,
  getDbTable,
  getMailLogList,
  getMailLogById,
  insertMailLog,
  createSession,
  updateSession,
  getSession,
  getSessions,
  revokeSessions,
  insertLlmQuery
};

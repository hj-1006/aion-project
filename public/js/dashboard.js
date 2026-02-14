async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { window.location.href = '/'; return; }
    var u = data.user;
    document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');
  } catch (_) {
    window.location.href = '/';
  }
}
async function loadCounts() {
  try {
    const s = await fetch('/api/syslog/events/count', { credentials: 'include' }).then(r => r.json());
    if (s.success) document.getElementById('syslogCount').textContent = s.count;
    // Telemetry 비활성: if (t.success) document.getElementById('telemetryCount').textContent = t.count;
  } catch (_) {}
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});
loadUser();
loadCounts();

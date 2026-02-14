async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { window.location.href = '/'; return; }
    var u = data.user;
    document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');
  } catch (_) { window.location.href = '/'; }
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
});

async function loadEvents() {
  const severity = document.getElementById('severityFilter').value;
  const params = new URLSearchParams({ limit: '100' });
  if (severity !== '') params.set('severity', severity);
  try {
    const res = await fetch('/api/syslog/events?' + params, { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('eventsBody');
    const status = document.getElementById('eventsStatus');
    if (!data.success) {
      tbody.innerHTML = '<tr><td colspan="5">조회 실패</td></tr>';
      status.textContent = data.message || '';
      return;
    }
    const events = data.events || [];
    tbody.innerHTML = events.length === 0
      ? '<tr><td colspan="5">이벤트 없음</td></tr>'
      : events.map(e => {
          const time = e.received_at ? new Date(e.received_at).toLocaleString('ko-KR') : '-';
          const sevClass = Number(e.severity) <= 3 ? 'severity-critical' : Number(e.severity) === 4 ? 'severity-warning' : 'severity-info';
          return `<tr><td>${time}</td><td>${escapeHtml(e.device_id || '-')}</td><td>${escapeHtml(e.host_from || '-')}</td><td class="${sevClass}">${e.severity}</td><td>${escapeHtml((e.message || '').slice(0, 200))}</td></tr>`;
        }).join('');
    status.textContent = events.length + '건';
  } catch (err) {
    document.getElementById('eventsBody').innerHTML = '<tr><td colspan="5">연결 오류</td></tr>';
    document.getElementById('eventsStatus').textContent = err.message || '';
  }
}
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
document.getElementById('refreshBtn').addEventListener('click', loadEvents);
document.getElementById('severityFilter').addEventListener('change', loadEvents);
loadUser();
loadEvents();

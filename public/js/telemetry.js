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

async function loadSnapshots() {
  try {
    const res = await fetch('/api/telemetry/snapshots?limit=50', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('snapshotsBody');
    const status = document.getElementById('snapshotsStatus');
    if (!data.success) {
      tbody.innerHTML = '<tr><td colspan="4">조회 실패 (자산이 없거나 DB 미연동)</td></tr>';
      status.textContent = data.message || '';
      return;
    }
    const snapshots = data.snapshots || [];
    tbody.innerHTML = snapshots.length === 0
      ? '<tr><td colspan="4">스냅샷 없음. 자산을 등록하고 Telemetry 수집이 돌면 표시됩니다.</td></tr>'
      : snapshots.map(s => {
          const time = s.collected_at ? new Date(s.collected_at).toLocaleString('ko-KR') : '-';
          const val = typeof s.value_json === 'string' ? s.value_json : JSON.stringify(s.value_json || {});
          return `<tr><td>${time}</td><td>${escapeHtml(s.device_id || '-')}</td><td>${escapeHtml(s.metric_type || '-')}</td><td><code style="font-size:0.85rem">${escapeHtml(val.slice(0, 150))}</code></td></tr>`;
        }).join('');
    status.textContent = snapshots.length + '건';
  } catch (err) {
    document.getElementById('snapshotsBody').innerHTML = '<tr><td colspan="4">연결 오류</td></tr>';
    document.getElementById('snapshotsStatus').textContent = err.message || '';
  }
}
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
document.getElementById('refreshBtn').addEventListener('click', loadSnapshots);
loadUser();
loadSnapshots();

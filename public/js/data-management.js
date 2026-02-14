let currentTable = null;
let currentData = { rows: [], total: 0, limit: 100, offset: 0 };

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

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function cellValue(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function loadTables() {
  const sel = document.getElementById('tableSelect');
  const statusEl = document.getElementById('tableLoadStatus');
  try {
    const res = await fetch('/api/db/tables', { credentials: 'include' });
    const data = await res.json();
    sel.innerHTML = '<option value="">선택...</option>';
    if (!res.ok || !data.success) {
      if (statusEl) { statusEl.textContent = '테이블 목록 실패: ' + (data.error || data.message || res.status); statusEl.style.display = 'block'; }
      return;
    }
    if (statusEl) statusEl.style.display = 'none';
    (data.tables || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name + (t.rows_approx != null ? ' (~' + t.rows_approx + ')' : '');
      sel.appendChild(opt);
    });
    if (statusEl) statusEl.textContent = (data.tables || []).length ? '' : '표시할 테이블 없음';
  } catch (e) {
    sel.innerHTML = '<option value="">로드 실패</option>';
    if (statusEl) { statusEl.textContent = '테이블 로드 실패: ' + (e.message || '연결 오류'); statusEl.style.display = 'block'; }
  }
}

async function loadTable() {
  const name = document.getElementById('tableSelect').value;
  if (!name) return;
  const limit = parseInt(document.getElementById('limitInput').value, 10) || 100;
  const offset = parseInt(document.getElementById('offsetInput').value, 10) || 0;
  try {
    const res = await fetch(`/api/db/table/${encodeURIComponent(name)}?limit=${limit}&offset=${offset}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      document.getElementById('tableBody').innerHTML = '<tr><td colspan="10">조회 실패: ' + escapeHtml(data.error || data.message) + '</td></tr>';
      return;
    }
    currentTable = name;
    currentData = { rows: data.rows || [], total: data.total ?? 0, limit: data.limit ?? limit, offset: data.offset ?? offset };
    renderTable(currentData.rows);
    renderPagination();
  } catch (e) {
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="10">연결 오류: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

function renderTable(rows) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  if (!rows || rows.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="10">데이터 없음</td></tr>';
    return;
  }
  const keys = Object.keys(rows[0]);
  thead.innerHTML = '<tr>' + keys.map(k => '<th>' + escapeHtml(k) + '</th>').join('') + '</tr>';
  tbody.innerHTML = rows.map(row =>
    '<tr>' + keys.map(k => {
      const v = row[k];
      const isJson = typeof v === 'object' || (typeof v === 'string' && (v.startsWith('{') || v.startsWith('[')));
      return '<td class="' + (isJson ? 'cell-json' : '') + '" title="' + escapeHtml(cellValue(v)) + '">' + escapeHtml(cellValue(v).slice(0, 200)) + '</td>';
    }).join('') + '</tr>'
  ).join('');
}

function renderPagination() {
  const { total, limit, offset } = currentData;
  const el = document.getElementById('pagination');
  if (total === 0) { el.textContent = ''; return; }
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  el.textContent = `총 ${total}건 중 ${from}–${to} 표시`;
}

function exportJson() {
  if (!currentData.rows.length) { alert('먼저 테이블을 조회하세요.'); return; }
  const blob = new Blob([JSON.stringify(currentData.rows, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentTable || 'export') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCsv() {
  if (!currentData.rows.length) { alert('먼저 테이블을 조회하세요.'); return; }
  const keys = Object.keys(currentData.rows[0]);
  const line = (arr) => arr.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  const csv = [line(keys), ...currentData.rows.map(row => line(keys.map(k => row[k])))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentTable || 'export') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('tab-mysql').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tab-mysql').classList.add('active');
  const tabTsdb = document.getElementById('tab-tsdb');
  const sectionTsdb = document.getElementById('section-tsdb');
  if (tabTsdb) tabTsdb.classList.remove('active');
  if (sectionTsdb) sectionTsdb.classList.remove('active');
  document.getElementById('section-mysql').classList.add('active');
});
// TSDB 비활성
// document.getElementById('tab-tsdb').addEventListener('click', (e) => { ... });

document.getElementById('btnLoad').addEventListener('click', loadTable);
document.getElementById('tableSelect').addEventListener('change', () => { if (document.getElementById('tableSelect').value) loadTable(); });
document.getElementById('btnExportJson').addEventListener('click', exportJson);
document.getElementById('btnExportCsv').addEventListener('click', exportCsv);

// document.getElementById('linkPrometheus').href = window.location.protocol + '//' + window.location.hostname + ':9090';  // TSDB 비활성

loadUser();
loadTables();

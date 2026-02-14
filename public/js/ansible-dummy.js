function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function numOrDash(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '-';
  return Number(v);
}
function pctWidth(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, Number(v)));
}
function tempWidth(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return 0;
  return Math.min(100, (Number(v) / 60) * 100);
}

function formatBps(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Gbps';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Mbps';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' Kbps';
  return Math.round(n) + ' bps';
}

function ringHtml(label, valuePct, displayValue, color) {
  const pct = Math.min(100, Math.max(0, valuePct || 0));
  return `
    <div class="metric-ring" style="--value:0; --ring-color:${color}; --ring-bg: var(--bg-input);" data-value="${pct}">
      <div class="ring-center">
        <div class="value">${displayValue}</div>
        <div class="label">${label}</div>
      </div>
    </div>
  `;
}

function statusBadge(status) {
  const s = status || 'no_data';
  const label = s === 'online' ? '온라인' : s === 'offline' ? '오프라인' : '미수집';
  return `<span class="status-badge status-badge--${s}" aria-label="상태: ${label}">${escapeHtml(label)}</span>`;
}

function renderCard(d) {
  const cpu = d.cpu_pct;
  const mem = d.mem_pct;
  const temp = d.temp_c;
  const ifaceUp = d.iface_up;
  const ifaceDown = d.iface_down;
  const cpuDisplay = cpu == null ? '-' : (numOrDash(cpu) + '%');
  const memDisplay = mem == null ? '-' : (numOrDash(mem) + '%');
  const tempDisplay = temp == null ? '-' : (numOrDash(temp) + '°C');
  const ifaceDisplay = (ifaceUp == null && ifaceDown == null) ? '-' : ('UP ' + numOrDash(ifaceUp) + ' / DOWN ' + numOrDash(ifaceDown));
  return `
    <div class="metric-card">
      <div class="metric-card-head">
        <span class="device">${escapeHtml(d.device_id)}</span>
        ${statusBadge(d.status)}
      </div>
      <div class="ring-row">
        ${ringHtml('CPU', pctWidth(cpu), cpuDisplay, '#16a34a')}
        ${ringHtml('메모리', pctWidth(mem), memDisplay, '#3b82f6')}
        ${ringHtml('온도', tempWidth(temp), tempDisplay, '#f97316')}
      </div>
      <div class="metric-extra">
        <div>인터페이스: ${escapeHtml(ifaceDisplay)}</div>
      </div>
    </div>
  `;
}

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

function buildMetricsFromSnapshots(snapshots, assets) {
  if (!assets || assets.length === 0) return [];
  const byDevice = {};
  assets.forEach(a => {
    const did = a.device_id || ('asset-' + a.id);
    byDevice[did] = { device_id: did, cpu_pct: null, mem_pct: null, temp_c: null, iface_up: null, iface_down: null, in_bps: null, out_bps: null, _hasSnapshot: false };
  });
  const sorted = [...(snapshots || [])].sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));
  const seen = {};
  sorted.forEach(s => {
    const deviceId = s.device_id;
    const key = deviceId + '-' + s.metric_type;
    if (seen[key]) return;
    if (!byDevice[deviceId]) return;
    seen[key] = true;
    byDevice[deviceId]._hasSnapshot = true;
    const val = typeof s.value_json === 'string' ? (() => { try { return JSON.parse(s.value_json); } catch (_) { return {}; } })() : (s.value_json || {});
    const m = byDevice[deviceId];
    if (s.metric_type === 'cpu' && val.cpu_pct != null) m.cpu_pct = val.cpu_pct;
    if (s.metric_type === 'mem' && val.mem_pct != null) m.mem_pct = val.mem_pct;
    if (s.metric_type === 'temp' && val.temp_c != null) m.temp_c = val.temp_c;
    if (s.metric_type === 'iface') {
      if (val.up != null) m.iface_up = val.up;
      if (val.down != null) m.iface_down = val.down;
    }
    if (s.metric_type === 'traffic') {
      if (val.in_bps != null) m.in_bps = val.in_bps;
      if (val.out_bps != null) m.out_bps = val.out_bps;
    }
  });
  const DEFAULT_CPU = 5;
  const DEFAULT_MEM = 20;
  const DEFAULT_TEMP = 30;
  return Object.values(byDevice).map(m => {
    const hasAny = m.cpu_pct != null || m.mem_pct != null || m.temp_c != null || m.iface_up != null || m.iface_down != null || m.in_bps != null || m.out_bps != null;
    let status = 'no_data';
    if (m._hasSnapshot) status = hasAny ? 'online' : 'offline';
    return {
      device_id: m.device_id,
      cpu_pct: m.cpu_pct ?? DEFAULT_CPU,
      mem_pct: m.mem_pct ?? DEFAULT_MEM,
      temp_c: m.temp_c ?? DEFAULT_TEMP,
      iface_up: m.iface_up,
      iface_down: m.iface_down,
      in_bps: m.in_bps,
      out_bps: m.out_bps,
      status
    };
  });
}

async function loadMetrics() {
  if (loadMetrics.isLoading) return;
  loadMetrics.isLoading = true;
  const grid = document.getElementById('metricGrid');
  const notice = document.getElementById('dummyNotice');
  const label = document.getElementById('dataSourceLabel');
  const summary = document.getElementById('metricsSummary');
  const listEl = document.getElementById('metricsList');
  if (notice) notice.textContent = '데이터 갱신 중…';
  try {
    const [snapRes, assetsRes] = await Promise.all([
      fetch('/api/telemetry/snapshots?limit=500', { credentials: 'include' }),
      fetch('/api/assets', { credentials: 'include' })
    ]);
    if (!snapRes.ok || !assetsRes.ok) {
      const code = !snapRes.ok ? snapRes.status : assetsRes.status;
      grid.innerHTML = '';
      if (notice) notice.textContent = 'API 연결 실패로 장비 메트릭을 불러올 수 없습니다. (HTTP ' + code + ')';
      if (label) label.textContent = '연결 실패 (' + code + ')';
      if (summary) summary.textContent = '장비 수: -';
      if (listEl) listEl.textContent = '-';
      return;
    }
    const snapData = await snapRes.json();
    const assetsData = await assetsRes.json();
    const snapshots = snapData.success ? (snapData.snapshots || []) : [];
    const assets = (assetsData.success ? (assetsData.assets || []) : []).filter(function (a) {
      const t = (a.type || '').toLowerCase();
      return t === 'router' || t === 'switch';
    });
    const list = buildMetricsFromSnapshots(snapshots, assets);
    if (list.length > 0) {
      requestAnimationFrame(function () {
        grid.innerHTML = list.map(renderCard).join('');
        requestAnimationFrame(function () {
          grid.querySelectorAll('.metric-ring[data-value]').forEach(function (el) {
            el.style.setProperty('--value', el.getAttribute('data-value'));
          });
        });
      });
      if (notice) notice.textContent = '장비는 장비 설정(자산) 기준이며, 수집되지 않은 값은 "-"로 표시됩니다.';
      if (label) label.textContent = '장비 ' + list.length + '대';
      if (summary) summary.textContent = '장비 수: ' + list.length + '대';
      if (listEl) listEl.textContent = list.map((d) => d.device_id).filter(Boolean).join(', ') || '-';
    } else {
      grid.innerHTML = '';
      if (notice) notice.textContent = '등록된 장비가 없습니다. 장비 설정에서 자산을 추가하세요.';
      if (label) label.textContent = '장비 없음';
      if (summary) summary.textContent = '장비 수: 0대';
      if (listEl) listEl.textContent = '-';
    }
  } catch (e) {
    grid.innerHTML = '';
    if (notice) notice.textContent = 'API 연결 실패로 장비 메트릭을 불러올 수 없습니다. (네트워크 오류)';
    if (label) label.textContent = '연결 실패';
    if (summary) summary.textContent = '장비 수: -';
    if (listEl) listEl.textContent = '-';
  } finally {
    loadMetrics.isLoading = false;
  }
}


function formatLogTs(ts) {
  if (ts == null) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function renderCollectionLogs(logs) {
  if (!logs || logs.length === 0) return '수집 로그가 없습니다.';
  return logs.map((log, i) => {
    const ts = formatLogTs(log.ts);
    const device = log.device_id ? escapeHtml(log.device_id) : '-';
    const msg = escapeHtml(log.message || '');
    const hasDetail = log.detail && String(log.detail).trim();
    const uniqueId = 'log-' + (log.ts || 0) + '-' + (log.device_id || '') + '-' + i;
    const detailId = 'detail-' + uniqueId;
    const detailEscaped = hasDetail ? escapeHtml(String(log.detail).slice(0, 1000)) : '';
    return (
      '<div class="collection-log-line" style="flex-direction:column; align-items:stretch;">' +
      '<div style="display:flex; flex-wrap:wrap; align-items:baseline; gap:0.5rem;">' +
      '<span class="collection-log-ts">' + ts + '</span>' +
      '<span class="collection-log-device">' + device + '</span>' +
      '<span class="collection-log-msg">' + msg + '</span>' +
      (hasDetail ? '<button type="button" class="collection-log-detail-toggle" data-detail-id="' + detailId + '">상세</button>' : '') +
      '</div>' +
      (hasDetail ? '<div id="' + detailId + '" class="collection-log-detail" style="display:none">' + detailEscaped + '</div>' : '') +
      '</div>'
    );
  }).join('');
}

async function refreshCollectionLogs() {
  const box = document.getElementById('collectionLogsBox');
  if (!box) return;
  var scrollTop = box.scrollTop;
  var scrollHeight = box.scrollHeight;
  const openDetails = new Set();
  box.querySelectorAll('.collection-log-detail').forEach(function (el) {
    if (el.style.display !== 'none') openDetails.add(el.id);
  });
  try {
    const res = await fetch('/api/telemetry/collection-logs?limit=200', { credentials: 'include' });
    const data = await res.json();
    var logs = (data.success && data.logs) ? data.logs : [];
    // 새 로그가 아래에 오도록 오래된 순으로 표시 (위로 밀리지 않음)
    logs = logs.slice().reverse();
    box.innerHTML = renderCollectionLogs(logs);
    box.querySelectorAll('.collection-log-detail-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = this.getAttribute('data-detail-id');
        const detailEl = document.getElementById(id);
        if (!detailEl) return;
        detailEl.style.display = detailEl.style.display === 'none' ? 'block' : 'none';
      });
    });
    openDetails.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });
    requestAnimationFrame(function () {
      box.scrollTop = scrollTop;
      if (box.scrollHeight > scrollHeight && scrollTop + box.clientHeight >= scrollHeight - 10) {
        box.scrollTop = box.scrollHeight;
      }
    });
  } catch (_) {
    if (box.innerHTML === '') box.innerHTML = '수집 로그를 불러올 수 없습니다.';
  }
}

loadUser();
loadMetrics();
refreshCollectionLogs();

function refreshData() {
  Promise.all([
    loadMetrics(),
    refreshCollectionLogs()
  ]).catch(function () {});
}
document.getElementById('btnRefresh').addEventListener('click', refreshData);
setInterval(refreshCollectionLogs, 4000);
setInterval(loadMetrics, 10000);

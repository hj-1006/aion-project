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
  const ifaceDisplay = (ifaceUp == null && ifaceDown == null) ? '-' : ('UP ' + numOrDash(ifaceUp) + ' / DOWN ' + numOrDash(ifaceDown));
  return `
    <div class="metric-card">
      <div class="metric-card-head">
        <span class="device">${escapeHtml(d.device_id)}</span>
        ${statusBadge(d.status)}
      </div>
      <div class="gauge-wrap">
        <div class="label">CPU 사용률</div>
        <div class="gauge-bar"><div class="gauge-fill cpu" style="width:${pctWidth(cpu)}%"></div></div>
        <div class="value">${numOrDash(cpu)}%</div>
      </div>
      <div class="gauge-wrap">
        <div class="label">메모리 사용률</div>
        <div class="gauge-bar"><div class="gauge-fill mem" style="width:${pctWidth(mem)}%"></div></div>
        <div class="value">${numOrDash(mem)}%</div>
      </div>
      <div class="gauge-wrap">
        <div class="label">온도</div>
        <div class="gauge-bar"><div class="gauge-fill temp" style="width:${tempWidth(temp)}%"></div></div>
        <div class="value">${numOrDash(temp)} °C</div>
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
    seen[key] = true;
    if (!byDevice[deviceId]) return;
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
  if (notice) notice.textContent = '데이터 갱신 중…';
  if (label) label.textContent = '';
  try {
    const [snapRes, assetsRes] = await Promise.all([
      fetch('/api/telemetry/snapshots?limit=500', { credentials: 'include' }),
      fetch('/api/assets', { credentials: 'include' })
    ]);
    const snapData = await snapRes.json();
    const assetsData = await assetsRes.json();
    const snapshots = snapData.success ? (snapData.snapshots || []) : [];
    const assets = (assetsData.success ? (assetsData.assets || []) : []).filter(function (a) {
      const t = (a.type || '').toLowerCase();
      return t === 'router' || t === 'switch';
    });
    const list = buildMetricsFromSnapshots(snapshots, assets);
    if (list.length > 0) {
      requestAnimationFrame(function () { grid.innerHTML = list.map(renderCard).join(''); });
      if (notice) notice.textContent = '장비는 장비 설정(자산) 기준이며, 수집되지 않은 값은 "-"로 표시됩니다.';
      if (label) label.textContent = '장비 ' + list.length + '대';
    } else {
      grid.innerHTML = '';
      if (notice) notice.textContent = '등록된 장비가 없습니다. 장비 설정에서 자산을 추가하세요.';
      if (label) label.textContent = '장비 없음';
    }
  } catch (_) {
    grid.innerHTML = '';
    if (notice) notice.textContent = 'API 연결 실패로 장비 메트릭을 불러올 수 없습니다.';
    if (label) label.textContent = '연결 실패';
  } finally {
    loadMetrics.isLoading = false;
  }
}

document.getElementById('btnRefresh').addEventListener('click', loadMetrics);

loadUser();
loadMetrics();
setInterval(loadMetrics, 10000);

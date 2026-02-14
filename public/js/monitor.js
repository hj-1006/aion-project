(() => {
  const state = {
    user: null,
    assets: [],
    devices: [],
    nodes: {},
    selectedId: null,
    nodeStatus: {},
    traceHops: [],
    traceAsset: null,
    tracePathEl: null,
    traceAnimEl: null,
    traceCutOffGroup: null,
    hopNodeGroups: [],
    traceHitIds: [],
    traceStartGroup: null,
    traceStartPosition: { x: 180, y: 260 },
    effectGradient: false
  };

  function getPrimaryIp(ips) {
    if (!ips || !ips.length) return null;
    const mgmt = ips.filter((ip) => /^172\.16\.(200|255)\./.test(ip) || /^192\.168\.200\./.test(ip) || /^10\.6\./.test(ip));
    return mgmt[0] || ips[0];
  }

  function groupAssetsByDevice(assets) {
    const byId = {};
    (assets || []).forEach((a) => {
      if (!a.device_id) return;
      if (!byId[a.device_id]) byId[a.device_id] = [];
      byId[a.device_id].push(a);
    });
    return Object.keys(byId).map((device_id) => {
      const rows = byId[device_id].sort((a, b) => Number(a.id) - Number(b.id));
      const rep = rows[0];
      const ips = rows.filter((r) => r.ip).map((r) => r.ip);
      const primaryIp = getPrimaryIp(ips);
      return {
        device_id,
        repId: rep.id,
        assetIds: rows.map((r) => r.id),
        type: rep.type,
        role: rep.role,
        pos_x: rep.pos_x,
        pos_y: rep.pos_y,
        ips,
        primaryIp,
        asset: { id: rep.id, device_id, type: rep.type, role: rep.role, ip: primaryIp || (ips[0] || null) }
      };
    });
  }

  const EFFECT_MAX_MS = 500;

  function colorByMs(ms) {
    const pct = ms == null ? 100 : Math.min(100, (ms / EFFECT_MAX_MS) * 100);
    const hue = 120 - (pct / 100) * 120;
    return `hsl(${hue}, 75%, 42%)`;
  }

  async function loadUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (!data.success) { window.location.href = '/'; return; }
      state.user = data.user || null;
      const u = state.user;
      document.getElementById('userName').textContent = (u?.display_name || u?.username || '-') + (u?.email ? ' (' + u.email + ') 님 환영합니다' : '');
    } catch (_) {
      window.location.href = '/';
    }
  }

  function statusClass(ms, status) {
    if (status === 'timeout' || ms == null) return 'timeout';
    if (ms < 150) return 'ok';
    if (ms < 300) return 'warn';
    return 'bad';
  }

  async function loadAssets() {
    const res = await fetch('/api/assets', { credentials: 'include' });
    const data = await res.json();
    state.assets = data.success ? (data.assets || []) : [];
    state.devices = groupAssetsByDevice(state.assets);
    if (!state.devices.length) {
      const list = document.getElementById('deviceList');
      if (list) list.innerHTML = '<div style="color: var(--text-muted);">등록된 장비가 없습니다. 시드 스크립트를 실행하세요.</div>';
      return;
    }
    renderList();
    renderTopology();
    pingAll();
    scheduleAssetRefresh();
  }

  function assetsHash(list) {
    return (list || [])
      .map((a) => [a.id, a.device_id, a.ip, a.type, a.role, a.location, a.pos_x, a.pos_y].join('|'))
      .join(';');
  }

  function scheduleAssetRefresh() {
    setInterval(async () => {
      try {
        const res = await fetch('/api/assets', { credentials: 'include' });
        const data = await res.json();
        const next = data.success ? (data.assets || []) : [];
        if (assetsHash(next) !== assetsHash(state.assets)) {
          state.assets = next;
          state.devices = groupAssetsByDevice(state.assets);
          state.nodes = {};
          renderList();
          renderTopology();
        }
      } catch (_) {}
    }, 15000);
  }

  function renderList() {
    const list = document.getElementById('deviceList');
    if (!state.devices.length) {
      list.innerHTML = '<div style="color: var(--text-muted);">등록된 장비가 없습니다.</div>';
      return;
    }
    list.innerHTML = state.devices.map((d) => {
      const meta = d.primaryIp ? (d.primaryIp + ' · ') : '';
      const typeRole = (d.type || 'other') + ' · ' + (d.role || 'group');
      const ipInfo = d.ips.length > 1 ? d.ips.length + '개 인터페이스' : (d.primaryIp || '-');
      return `
        <div class="device-item" data-id="${d.repId}">
          <div>
            <div class="name">${d.device_id || '-'}</div>
            <div class="meta">${ipInfo} · ${typeRole}</div>
          </div>
          <div class="status-dot status-timeout" id="dot-${d.repId}"></div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('.device-item').forEach((el) => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.device-item').forEach((i) => i.classList.remove('active'));
        el.classList.add('active');
        state.selectedId = el.getAttribute('data-id');
        loadTraceForSelected();
      });
    });
  }

  function renderTopology() {
    const svg = document.getElementById('topologySvg');
    svg.innerHTML = '';
    state.links = [];
    state.traceHops = [];
    state.traceAsset = null;
    state.tracePathEl = null;
    state.traceAnimEl = null;
    state.hopNodeGroups = [];
    state.traceHitIds = [];
    state.traceStartGroup = null;
    state.traceStartPosition = { x: 180, y: 260 };
    const layout = {
      ISP_R1: { x: 120, y: 60 },
      ISP_R2: { x: 320, y: 60 },
      BB_L3SW1: { x: 120, y: 160 },
      BB_L3SW2: { x: 320, y: 160 },
      BB_R1: { x: 120, y: 260 },
      BB_R2: { x: 320, y: 260 },
      LAB_L3SW1: { x: 120, y: 360 },
      LAB_L3SW2: { x: 320, y: 360 },
      Management_L2SW1: { x: 520, y: 120 },
      Management_L2SW2: { x: 720, y: 120 },
      Research_L2SW1: { x: 520, y: 280 },
      Server_L2SW1: { x: 520, y: 400 },
      Server_L2SW2: { x: 720, y: 400 }
    };

    const links = [
      ['ISP_R1', 'BB_L3SW1'],
      ['ISP_R1', 'ISP_R2'],
      ['ISP_R2', 'BB_L3SW2'],
      ['BB_L3SW1', 'BB_R1'],
      ['BB_L3SW1', 'BB_L3SW2'],
      ['BB_L3SW1', 'Management_L2SW1'],
      ['BB_L3SW1', 'Management_L2SW2'],
      ['BB_L3SW2', 'BB_R2'],
      ['BB_L3SW2', 'Management_L2SW1'],
      ['BB_L3SW2', 'Management_L2SW2'],
      ['BB_R1', 'BB_R2'],
      ['BB_R1', 'LAB_L3SW1'],
      ['BB_R2', 'LAB_L3SW2'],
      ['LAB_L3SW1', 'LAB_L3SW2'],
      ['LAB_L3SW1', 'Research_L2SW1'],
      ['LAB_L3SW1', 'Server_L2SW1'],
      ['LAB_L3SW2', 'Research_L2SW1'],
      ['LAB_L3SW2', 'Server_L2SW2'],
      ['Management_L2SW1', 'Management_L2SW2'],
      ['Server_L2SW1', 'Server_L2SW2']
    ];

    const byName = {};
    state.devices.forEach((d) => { byName[d.device_id] = d; });

    links.forEach(([from, to]) => {
      const fromDev = byName[from];
      const toDev = byName[to];
      if (!fromDev || !toDev) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'topology-link');
      svg.appendChild(line);
      state.links.push({ fromId: fromDev.repId, toId: toDev.repId, line });
    });

    let fallbackIndex = 0;
    const fallbackStart = { x: 140, y: 470 };
    const fallbackGap = 90;

    state.devices.forEach((device) => {
      const hasPos = device.pos_x != null && device.pos_y != null;
      const pos = hasPos ? { x: Number(device.pos_x), y: Number(device.pos_y) } : (layout[device.device_id] || {
        x: fallbackStart.x + fallbackGap * fallbackIndex++,
        y: fallbackStart.y
      });
      const nodeObj = createNode(device.asset, pos.x, pos.y);
      svg.appendChild(nodeObj.group);
      state.nodes[device.repId] = nodeObj;
      attachDrag(device, nodeObj);
    });
    updateLinks();
  }

  function displayType(t) {
    if (t === 'router') return '라우터';
    if (t === 'switch') return '스위치';
    if (t === 'server') return '서버';
    return '기타';
  }

  function pointsToSmoothPathD(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = 'M ' + points[0].x + ' ' + points[0].y;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const prev = points[i - 2];
      const next = points[i + 1];
      const cp1x = prev != null ? p0.x + (p1.x - prev.x) / 6 : p0.x;
      const cp1y = prev != null ? p0.y + (p1.y - prev.y) / 6 : p0.y;
      const cp2x = next != null ? p1.x - (next.x - p0.x) / 6 : p1.x;
      const cp2y = next != null ? p1.y - (next.y - p0.y) / 6 : p1.y;
      d += ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + p1.x + ' ' + p1.y;
    }
    return d;
  }

  function attachDrag(device, nodeObj) {
    if (!state.user || state.user.role !== 'admin') return;
    const repId = device.repId;
    let dragging = false;
    let start = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    nodeObj.group.style.cursor = 'move';
    nodeObj.group.addEventListener('mousedown', (e) => {
      dragging = true;
      start = { x: e.clientX, y: e.clientY };
      origin = { x: state.nodes[repId].x, y: state.nodes[repId].y };
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const x = origin.x + dx;
      const y = origin.y + dy;
      updateNodePosition(repId, x, y);
    });
    window.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      const pos = state.nodes[repId];
      const body = JSON.stringify({ pos_x: Math.round(pos.x), pos_y: Math.round(pos.y) });
      try {
        await Promise.all(device.assetIds.map((id) =>
          fetch('/api/assets/' + encodeURIComponent(id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
          })
        ));
      } catch (_) {}
    });
  }

  function updateNodePosition(id, x, y) {
    const node = state.nodes[id];
    if (!node) return;
    node.x = x;
    node.y = y;
    setNodePosition(node, x, y);
    updateLinks();
    updateTracePath();
  }

  function updateLinks() {
    if (!state.links) return;
    state.links.forEach((l) => {
      const from = state.nodes[l.fromId];
      const to = state.nodes[l.toId];
      if (!from || !to) return;
      l.line.setAttribute('x1', from.x);
      l.line.setAttribute('y1', from.y);
      l.line.setAttribute('x2', to.x);
      l.line.setAttribute('y2', to.y);
    });
  }
  function createNode(asset, x, y) {
    const type = asset.type || 'other';
    let shape;
    let dims = { w: 0, h: 0, r: 0 };
    if (type === 'router') {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shape.setAttribute('r', 18);
      dims.r = 18;
    } else if (type === 'server') {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shape.setAttribute('width', 40);
      shape.setAttribute('height', 28);
      shape.setAttribute('rx', 4);
      dims = { w: 40, h: 28, r: 0 };
    } else if (type === 'switch') {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shape.setAttribute('width', 32);
      shape.setAttribute('height', 24);
      shape.setAttribute('rx', 4);
      dims = { w: 32, h: 24, r: 0 };
    } else {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shape.setAttribute('width', 28);
      shape.setAttribute('height', 20);
      shape.setAttribute('rx', 3);
      dims = { w: 28, h: 20, r: 0 };
    }
    shape.setAttribute('class', 'topology-node timeout');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const typeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    typeLabel.setAttribute('text-anchor', 'middle');
    typeLabel.setAttribute('class', 'topology-label');
    typeLabel.textContent = displayType(asset.type);

    const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameLabel.setAttribute('text-anchor', 'middle');
    nameLabel.setAttribute('class', 'topology-label');
    nameLabel.textContent = '(' + (asset.device_id || '-') + ')';

    const ipLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ipLabel.setAttribute('text-anchor', 'middle');
    ipLabel.setAttribute('class', 'topology-label');
    ipLabel.setAttribute('fill', '#94a3b8');
    ipLabel.textContent = asset.ip || '-';

    const msLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    msLabel.setAttribute('text-anchor', 'middle');
    msLabel.setAttribute('class', 'topology-ms');
    msLabel.textContent = '-';

    group.appendChild(shape);
    group.appendChild(typeLabel);
    group.appendChild(nameLabel);
    group.appendChild(ipLabel);
    group.appendChild(msLabel);
    const nodeObj = { node: shape, group, x, y, dims, labels: { typeLabel, nameLabel, ipLabel, msLabel } };
    setNodePosition(nodeObj, x, y);
    return nodeObj;
  }

  function setNodePosition(nodeObj, x, y) {
    const { node, dims, labels } = nodeObj;
    if (node.tagName.toLowerCase() === 'circle') {
      node.setAttribute('cx', x);
      node.setAttribute('cy', y);
    } else {
      node.setAttribute('x', x - dims.w / 2);
      node.setAttribute('y', y - dims.h / 2);
    }
    labels.typeLabel.setAttribute('x', x);
    labels.typeLabel.setAttribute('y', y - 26);
    labels.nameLabel.setAttribute('x', x);
    labels.nameLabel.setAttribute('y', y + 30);
    labels.ipLabel.setAttribute('x', x);
    labels.ipLabel.setAttribute('y', y + 44);
    if (labels.msLabel) {
      labels.msLabel.setAttribute('x', x);
      labels.msLabel.setAttribute('y', y + 58);
    }
  }

  async function pingAsset(asset) {
    if (!asset || !asset.ip) return { status: 'timeout', ms: null };
    const res = await fetch(`/api/monitor/ping?ip=${encodeURIComponent(asset.ip)}`, { credentials: 'include' });
    const data = await res.json();
    return data;
  }

  function applyNodeStatus(a, result) {
    const cls = statusClass(result.ms, result.status);
    state.nodeStatus[a.id] = { cls, ms: result.ms };
    const dot = document.getElementById(`dot-${a.id}`);
    if (dot) {
      dot.title = result.ms != null ? `${result.ms}ms` : 'timeout';
      if (state.effectGradient) {
        dot.className = 'status-dot status-gradient';
        dot.style.background = colorByMs(result.ms);
      } else {
        dot.className = `status-dot status-${cls}`;
        dot.style.background = '';
      }
    }
    const nodeObj = state.nodes[a.id];
    if (nodeObj) {
      const node = nodeObj.node;
      const active = String(a.id) === String(state.selectedId);
      const traceHit = state.traceHitIds.some((id) => String(id) === String(a.id));
      if (state.effectGradient) {
        node.setAttribute('class', `topology-node status-gradient${active ? ' active' : ''}${traceHit ? ' trace-hit' : ''}`);
        node.style.fill = colorByMs(result.ms);
      } else {
        node.setAttribute('class', `topology-node ${cls}${active ? ' active' : ''}${traceHit ? ' trace-hit' : ''}`);
        node.style.fill = '';
      }
      if (nodeObj.labels && nodeObj.labels.msLabel) {
        nodeObj.labels.msLabel.textContent = result.ms != null ? result.ms + ' ms' : '-';
      }
    }
  }

  async function pingAll() {
    if (!state.devices.length) return;
    await Promise.all(state.devices.map(async (d) => {
      if (!d.primaryIp) {
        applyNodeStatus(d.asset, { status: 'timeout', ms: null });
        return;
      }
      const result = await pingAsset({ id: d.repId, ip: d.primaryIp });
      applyNodeStatus(d.asset, result);
    }));
    setTimeout(pingAll, 5000);
  }

  function clearTraceArtifacts() {
    const svg = document.getElementById('topologySvg');
    svg.querySelectorAll('.path-link, .path-anim, .hop-node, .trace-start-node, .trace-cutoff').forEach((el) => el.remove());
    if (state.traceHitIds.length) {
      state.traceHitIds.forEach((id) => {
        const nodeObj = state.nodes[id];
        if (nodeObj && nodeObj.node) nodeObj.node.classList.remove('trace-hit');
      });
    }
    state.traceHitIds = [];
    state.tracePathEl = null;
    state.traceAnimEl = null;
    state.hopNodeGroups = [];
    state.traceStartGroup = null;
    state.traceCutOffGroup = null;
  }

  async function loadTraceForSelected() {
    const device = state.devices.find((d) => String(d.repId) === String(state.selectedId));
    const statusEl = document.getElementById('traceStatus');
    const outputEl = document.getElementById('traceOutput');
    clearTraceArtifacts();
    const traceIp = device ? device.primaryIp : null;
    if (!device || !traceIp) {
      statusEl.textContent = '장비 IP가 없습니다.';
      outputEl.textContent = '';
      return;
    }
    statusEl.textContent = '경로 조회 중...';
    outputEl.textContent = '';
    refreshActiveNode();
    try {
      const res = await fetch(`/api/monitor/traceroute?ip=${encodeURIComponent(traceIp)}`, { credentials: 'include' });
      const data = await res.json();
      if (!data.success || !data.hops) {
        statusEl.textContent = '경로 조회 실패';
        return;
      }
      const lines = data.hops.map((h) => `${h.hop}. ${h.ip || '*'} ${h.rtt_ms != null ? (h.rtt_ms.toFixed(1) + 'ms') : ''}`);
      outputEl.textContent = lines.join('\n') || '경로 없음';
      statusEl.textContent = data.status === 'timeout' ? '타임아웃' : '경로 표시 중';
      state.traceHops = data.hops || [];
      state.traceAsset = device.asset;
      drawTracePath(state.traceHops, device.asset);
    } catch (_) {
      statusEl.textContent = '경로 조회 실패';
    }
  }

  function refreshActiveNode() {
    Object.keys(state.nodes).forEach((id) => {
      const nodeObj = state.nodes[id];
      if (!nodeObj || !nodeObj.node) return;
      const status = state.nodeStatus[id];
      const cls = (status && status.cls) ? status.cls : 'timeout';
      const active = String(id) === String(state.selectedId);
      const traceHit = state.traceHitIds.some((hitId) => String(hitId) === String(id));
      if (state.effectGradient) {
        nodeObj.node.setAttribute('class', `topology-node status-gradient${active ? ' active' : ''}${traceHit ? ' trace-hit' : ''}`);
        nodeObj.node.style.fill = colorByMs(status && status.ms);
      } else {
        nodeObj.node.setAttribute('class', `topology-node ${cls}${active ? ' active' : ''}${traceHit ? ' trace-hit' : ''}`);
        nodeObj.node.style.fill = '';
      }
      if (nodeObj.labels && nodeObj.labels.msLabel) {
        nodeObj.labels.msLabel.textContent = (status && status.ms != null) ? status.ms + ' ms' : '-';
      }
    });
    state.devices.forEach((d) => {
      const dot = document.getElementById(`dot-${d.repId}`);
      if (!dot) return;
      const status = state.nodeStatus[d.repId];
      if (state.effectGradient) {
        dot.className = 'status-dot status-gradient';
        dot.style.background = colorByMs(status && status.ms);
      } else {
        dot.className = `status-dot ${(status && status.cls) ? status.cls : 'timeout'}`;
        dot.style.background = '';
      }
    });
  }

  function buildTracePoints(hops, asset) {
    const target = state.nodes[asset.id];
    if (!target) return { points: [], cutOff: false };
    const cutOff = Array.isArray(hops) && hops.length > 0 && (() => {
      const lastHop = hops[hops.length - 1];
      return !lastHop.ip || String(lastHop.ip).trim() === '' || lastHop.ip === '*';
    })();
    const start = { type: 'start', x: state.traceStartPosition.x, y: state.traceStartPosition.y };
    const ipMap = {};
    state.devices.forEach((d) => {
      d.ips.forEach((ip) => { if (ip) ipMap[ip] = d.repId; });
    });
    const rawPoints = [start];
    (hops || []).forEach((hop) => {
      if (!hop.ip || String(hop.ip).trim() === '' || hop.ip === '*') {
        if (cutOff) return;
        rawPoints.push({ type: 'hop', ip: '?', rtt_ms: hop.rtt_ms });
        return;
      }
      const hopIp = hop.ip || '*';
      const matchedId = hop.ip ? ipMap[hop.ip] : null;
      const matchedNode = matchedId ? state.nodes[matchedId] : null;
      if (matchedNode) {
        rawPoints.push({
          type: 'asset',
          assetId: matchedId,
          ip: hopIp,
          rtt_ms: hop.rtt_ms,
          x: matchedNode.x,
          y: matchedNode.y
        });
      } else {
        rawPoints.push({
          type: 'hop',
          ip: hopIp,
          rtt_ms: hop.rtt_ms
        });
      }
    });

    const last = rawPoints[rawPoints.length - 1];
    if (!cutOff && !(last && last.type === 'asset' && last.assetId === asset.id)) {
      rawPoints.push({ type: 'target', assetId: asset.id, x: target.x, y: target.y });
    }

    const points = [];
    let lastAnchor = rawPoints[0];
    points.push(lastAnchor);
    let buffer = [];
    for (let i = 1; i < rawPoints.length; i++) {
      const point = rawPoints[i];
      const isAnchor = typeof point.x === 'number' && typeof point.y === 'number';
      if (isAnchor) {
        const count = buffer.length;
        for (let j = 0; j < count; j++) {
          const t = (j + 1) / (count + 1);
          buffer[j].x = lastAnchor.x + (point.x - lastAnchor.x) * t;
          buffer[j].y = lastAnchor.y + (point.y - lastAnchor.y) * t;
          points.push(buffer[j]);
        }
        points.push(point);
        buffer = [];
        lastAnchor = point;
      } else {
        buffer.push(point);
      }
    }
    return { points, cutOff };
  }

  function drawTracePath(hops, asset) {
    const svg = document.getElementById('topologySvg');
    clearTraceArtifacts();
    if (!hops || hops.length === 0) return;
    const target = state.nodes[asset.id];
    if (!target) return;

    const { points, cutOff } = buildTracePoints(hops, asset);
    if (points.length < 2) return;

    const startPoint = points[0];
    if (startPoint) {
      const startGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      startGroup.setAttribute('class', 'trace-start-node');
      startGroup.setAttribute('title', '드래그하여 위치 이동');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', startPoint.x);
      circle.setAttribute('cy', startPoint.y);
      circle.setAttribute('r', 10);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', startPoint.x);
      text.setAttribute('y', startPoint.y - 14);
      text.setAttribute('text-anchor', 'middle');
      text.textContent = '관리 서버';
      startGroup.appendChild(circle);
      startGroup.appendChild(text);
      svg.appendChild(startGroup);
      state.traceStartGroup = startGroup;
      attachTraceStartDrag(startGroup);
    }

    const hitIds = new Set();
    points.forEach((p, idx) => {
      if (idx === 0) return;
      if (p.type === 'asset' && p.assetId && p.assetId !== asset.id) {
        hitIds.add(p.assetId);
        return;
      }
      if (p.type === 'hop') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'hop-node');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', 8);
        const ipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        ipText.setAttribute('x', p.x);
        ipText.setAttribute('y', p.y + 18);
        ipText.setAttribute('text-anchor', 'middle');
        ipText.setAttribute('class', 'topology-label hop-label');
        ipText.textContent = p.ip;
        const msText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        msText.setAttribute('x', p.x);
        msText.setAttribute('y', p.y + 30);
        msText.setAttribute('text-anchor', 'middle');
        msText.setAttribute('class', 'topology-ms');
        msText.textContent = p.rtt_ms != null ? p.rtt_ms.toFixed(1) + ' ms' : '*';
        g.appendChild(circle);
        g.appendChild(ipText);
        g.appendChild(msText);
        svg.appendChild(g);
        state.hopNodeGroups.push({ group: g, pointIndex: idx, x: p.x, y: p.y });
      }
    });

    hitIds.forEach((id) => {
      const nodeObj = state.nodes[id];
      if (nodeObj && nodeObj.node) {
        nodeObj.node.classList.add('trace-hit');
        state.traceHitIds.push(id);
      }
    });

    const d = pointsToSmoothPathD(points);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', cutOff ? 'path-link path-link-cutoff' : 'path-link');
    svg.appendChild(path);
    state.tracePathEl = path;

    if (cutOff && points.length > 0) {
      const last = points[points.length - 1];
      const cutOffG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      cutOffG.setAttribute('class', 'trace-cutoff');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', last.x);
      dot.setAttribute('cy', last.y);
      dot.setAttribute('r', 8);
      dot.setAttribute('class', 'trace-cutoff-dot');
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', last.x);
      label.setAttribute('y', last.y - 14);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'trace-cutoff-label');
      label.textContent = '경로 끊김';
      cutOffG.appendChild(dot);
      cutOffG.appendChild(label);
      svg.appendChild(cutOffG);
      state.traceCutOffGroup = cutOffG;
    }

    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    anim.setAttribute('r', '4');
    anim.setAttribute('class', 'path-anim');
    const motion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    motion.setAttribute('dur', '3s');
    motion.setAttribute('repeatCount', 'indefinite');
    motion.setAttribute('path', d);
    anim.appendChild(motion);
    svg.appendChild(anim);
    state.traceAnimEl = anim;
  }

  function attachTraceStartDrag(startGroup) {
    let dragging = false;
    let start = { x: 0, y: 0 };
    let origin = { x: state.traceStartPosition.x, y: state.traceStartPosition.y };
    startGroup.style.cursor = 'move';
    startGroup.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      start = { x: e.clientX, y: e.clientY };
      origin = { x: state.traceStartPosition.x, y: state.traceStartPosition.y };
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      state.traceStartPosition.x = Math.round(origin.x + dx);
      state.traceStartPosition.y = Math.round(origin.y + dy);
      updateTracePath();
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  function updateTracePath() {
    if (!state.traceAsset || !state.traceHops.length) return;
    const { points, cutOff } = buildTracePoints(state.traceHops, state.traceAsset);
    if (points.length < 2) return;
    if (state.traceStartGroup && points[0]) {
      const circle = state.traceStartGroup.querySelector('circle');
      const text = state.traceStartGroup.querySelector('text');
      if (circle) { circle.setAttribute('cx', points[0].x); circle.setAttribute('cy', points[0].y); }
      if (text) { text.setAttribute('x', points[0].x); text.setAttribute('y', points[0].y - 14); }
    }
    state.hopNodeGroups.forEach((hop) => {
      const p = points[hop.pointIndex];
      if (!p) return;
      hop.x = p.x;
      hop.y = p.y;
      const circle = hop.group.querySelector('circle');
      const texts = hop.group.querySelectorAll('text');
      const ipText = texts[0];
      const msText = texts[1];
      if (circle) { circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y); }
      if (ipText) { ipText.setAttribute('x', p.x); ipText.setAttribute('y', p.y + 18); ipText.textContent = p.ip || '*'; }
      if (msText) { msText.setAttribute('x', p.x); msText.setAttribute('y', p.y + 30); msText.textContent = p.rtt_ms != null ? p.rtt_ms.toFixed(1) + ' ms' : '*'; }
    });
    const d = pointsToSmoothPathD(points);
    if (state.tracePathEl) {
      state.tracePathEl.setAttribute('d', d);
      state.tracePathEl.setAttribute('class', cutOff ? 'path-link path-link-cutoff' : 'path-link');
    }
    if (state.traceAnimEl) {
      const motion = state.traceAnimEl.querySelector('animateMotion');
      if (motion) motion.setAttribute('path', d);
    }
    if (state.traceCutOffGroup && points.length > 0) {
      const last = points[points.length - 1];
      const dot = state.traceCutOffGroup.querySelector('circle');
      const label = state.traceCutOffGroup.querySelector('text');
      if (dot) { dot.setAttribute('cx', last.x); dot.setAttribute('cy', last.y); }
      if (label) { label.setAttribute('x', last.x); label.setAttribute('y', last.y - 14); }
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  });

  const effectToggle = document.getElementById('effectToggle');
  const effectToggleLabel = document.getElementById('effectToggleLabel');
  if (effectToggle) {
    effectToggle.addEventListener('click', () => {
      state.effectGradient = !state.effectGradient;
      effectToggle.setAttribute('aria-pressed', state.effectGradient ? 'true' : 'false');
      effectToggleLabel.textContent = state.effectGradient ? '효과 끄기' : '효과 켜기';
      if (state.effectGradient) effectToggle.classList.add('active');
      else effectToggle.classList.remove('active');
      refreshActiveNode();
    });
  }

  loadUser().then(loadAssets);
})();

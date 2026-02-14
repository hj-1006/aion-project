import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as queryClient from '../lib/queryClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POLL_MS = parseInt(process.env.TELEMETRY_POLL_INTERVAL_MS || '60000', 10);

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const DEVICE_MAP_PATHS = [
  path.join(PROJECT_ROOT, 'config', 'device-ansible-host.json'),
  path.join(process.cwd(), 'config', 'device-ansible-host.json')
];

let intervalId = null;
let deviceAnsibleMap = null;
let ansibleServiceCache = null;
const lastTrafficByAsset = new Map();

const MAX_COLLECTION_LOGS = 1000;
const CONCURRENCY = parseInt(process.env.TELEMETRY_CONCURRENCY || '8', 10);
const collectionLogs = [];

function pushLog(device_id, level, message, detail) {
  const entry = { ts: Date.now(), device_id: device_id || null, level, message, detail: detail || null };
  collectionLogs.push(entry);
  if (collectionLogs.length > MAX_COLLECTION_LOGS) collectionLogs.shift();
}

function getRecentLogs(limit) {
  const n = Math.min(Math.max(0, parseInt(limit, 10) || 200), MAX_COLLECTION_LOGS);
  return collectionLogs.slice(-n).reverse();
}

/** 상세 로그에서 서버 경로 등 민감 정보 제거 */
function sanitizeLogDetail(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\/root\/[^\s'"]+/g, '/***')
    .replace(/Command failed:\s*ansible-playbook[^\n]*/g, 'Ansible playbook 실행 실패.')
    .slice(0, 500);
}

function resolveToAnsibleHost(deviceId) {
  if (!deviceAnsibleMap) {
    deviceAnsibleMap = {};
    for (const p of DEVICE_MAP_PATHS) {
      try {
        if (fs.existsSync(p)) {
          deviceAnsibleMap = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      } catch (_) {}
    }
  }
  return (deviceAnsibleMap[deviceId] && String(deviceAnsibleMap[deviceId]).trim()) || deviceId;
}

async function getAnsibleService() {
  if (ansibleServiceCache) return ansibleServiceCache;
  ansibleServiceCache = await import('./ansibleService.js');
  return ansibleServiceCache;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractCommandOutput(stdout) {
  if (!stdout) return '';
  let result = '';
  const msgMatches = stdout.match(/"msg":\s*"([\s\S]*?)"/g);
  if (msgMatches && msgMatches.length > 0) {
    const last = msgMatches[msgMatches.length - 1];
    const m = last.match(/"msg":\s*"([\s\S]*?)"/);
    if (m && m[1]) {
      result = m[1].replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  if (!result) {
    const stdLinesMatch = stdout.match(/"[\w.]+\.stdout_lines":\s*\[\s*\[\s*"((?:[^"\\]|\\.)*)"/);
    if (stdLinesMatch && stdLinesMatch[1]) {
      result = stdLinesMatch[1].replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  if (!result) {
    const stdoutMatch = stdout.match(/"stdout":\s*\[\s*"((?:[^"\\]|\\.)*)"/);
    if (stdoutMatch && stdoutMatch[1]) {
      result = stdoutMatch[1].replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  return result || stdout;
}

function parseCpuFromShow(text) {
  if (!text) return null;
  const m = text.match(/CPU utilization for five seconds:\s*([\d.]+)%/i) || text.match(/five seconds:\s*([\d.]+)%/i);
  return m ? toNumber(m[1]) : null;
}

function parseMemFromShow(text) {
  if (!text) return null;
  // Cisco "Processor Pool Total / Used" 형식
  let m = text.match(/Processor Pool Total:\s*(\d+)\s+Used:\s*(\d+)/i) || text.match(/Total:\s*(\d+)\s+Used:\s*(\d+)/i);
  // Cisco "Head Total(b) Used(b) ..." 다음 줄 "Processor <hex> <total> <used> ..." 형식
  if (!m) m = text.match(/Processor\s+\S+\s+(\d+)\s+(\d+)/i);
  if (!m) return null;
  const total = toNumber(m[1]);
  const used = toNumber(m[2]);
  if (!total || used == null) return null;
  return Math.round((used / total) * 100);
}

function parseTempFromShow(text) {
  if (!text) return null;
  const m = text.match(/Temperature[^\d]*(\d+)\s*C/i) || text.match(/(\d+)\s*C/i);
  return m ? toNumber(m[1]) : null;
}

function parseIfaceStatusFromShow(text) {
  if (!text) return { up: null, down: null };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let up = 0;
  let down = 0;
  for (const line of lines) {
    if (/^Interface\s+/i.test(line)) continue;
    if (/^---/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const status = parts[parts.length - 2].toLowerCase();
    const protocol = parts[parts.length - 1].toLowerCase();
    if (status === 'up' && protocol === 'up') up += 1;
    else down += 1;
  }
  return { up, down };
}

function parseTrafficFromShow(text) {
  if (!text) return { in_bps: null, out_bps: null };
  let inBps = 0;
  let outBps = 0;
  const inMatches = text.match(/input rate\s+(\d+)\s+bits\/sec/gi) || [];
  const outMatches = text.match(/output rate\s+(\d+)\s+bits\/sec/gi) || [];
  inMatches.forEach(m => {
    const v = m.match(/(\d+)\s+bits\/sec/i);
    if (v && v[1]) inBps += Number(v[1]);
  });
  outMatches.forEach(m => {
    const v = m.match(/(\d+)\s+bits\/sec/i);
    if (v && v[1]) outBps += Number(v[1]);
  });
  return { in_bps: inBps || null, out_bps: outBps || null };
}

async function processAsset(a) {
  pushLog(a.device_id, 'info', '수집 시작', a.ip ? 'IP: ' + a.ip : null);
  let cpuPct = null;
  let memPct = null;
  let tempC = null;
  let ifaceUp = null;
  let ifaceDown = null;
  let inBps = null;
  let outBps = null;

  if (a.device_id) {
    try {
      const ansibleService = await getAnsibleService();
      const ansibleHost = resolveToAnsibleHost(a.device_id);
      const options = a.ip ? { ansible_host: a.ip } : undefined;

      {
        const res = await ansibleService.runShowCommand(ansibleHost, 'show processes cpu', options);
        if (!res.success) {
          pushLog(a.device_id, 'warn', 'Ansible show processes cpu 실패', [res.error, (res.stderr || '').slice(0, 200)].filter(Boolean).join('\n'));
        } else {
          let out = extractCommandOutput(res.stdout || '');
          if (!out && res.stdout) out = res.stdout;
          const val = parseCpuFromShow(out);
          if (val != null) cpuPct = val;
          else pushLog(a.device_id, 'warn', 'CPU 파싱 실패 (값 없음)', (out || '').slice(0, 400));
        }
      }
      {
        const res = await ansibleService.runShowCommand(ansibleHost, 'show memory', options);
        if (!res.success) {
          pushLog(a.device_id, 'warn', 'Ansible show memory 실패', sanitizeLogDetail([res.error, res.stderr].filter(Boolean).join('\n')));
        } else {
          let out = extractCommandOutput(res.stdout || '');
          if (!out && res.stdout) out = res.stdout;
          const val = parseMemFromShow(out);
          if (val != null) memPct = val;
          else if (out && out.length > 50) pushLog(a.device_id, 'warn', 'Memory 파싱 실패 (형식 미지원)', (out || '').slice(0, 400));
        }
      }
      {
        const res = await ansibleService.runShowCommand(ansibleHost, 'show environment', options);
        if (!res.success) {
          pushLog(a.device_id, 'info', 'Ansible show environment 실패 (일부 장비 미지원)', sanitizeLogDetail(res.error || res.stderr));
        } else {
          let out = extractCommandOutput(res.stdout || '');
          if (!out && res.stdout) out = res.stdout;
          const val = parseTempFromShow(out);
          if (val != null) tempC = val;
          else if (out && out.length) pushLog(a.device_id, 'warn', 'Temp 파싱 실패 (값 없음)', (out || '').slice(0, 400));
        }
      }
      {
        const res = await ansibleService.runShowCommand(ansibleHost, 'show ip interface brief', options);
        if (!res.success) {
          pushLog(a.device_id, 'warn', 'Ansible show ip interface brief 실패', sanitizeLogDetail([res.error, res.stderr].filter(Boolean).join('\n')));
        } else {
          let out = extractCommandOutput(res.stdout || '');
          if (!out && res.stdout) out = res.stdout;
          const val = parseIfaceStatusFromShow(out);
          if (val.up != null) ifaceUp = val.up;
          if (val.down != null) ifaceDown = val.down;
          else pushLog(a.device_id, 'warn', 'Iface 파싱 실패 (값 없음)', (out || '').slice(0, 400));
        }
      }
      {
        const res = await ansibleService.runShowCommand(ansibleHost, 'show interfaces', options);
        if (!res.success) {
          pushLog(a.device_id, 'warn', 'Ansible show interfaces 실패', sanitizeLogDetail([res.error, res.stderr].filter(Boolean).join('\n')));
        } else {
          let out = extractCommandOutput(res.stdout || '');
          if (!out && res.stdout) out = res.stdout;
          const val = parseTrafficFromShow(out);
          if (val.in_bps != null) inBps = val.in_bps;
          if (val.out_bps != null) outBps = val.out_bps;
        }
      }
    } catch (e) {
      pushLog(a.device_id, 'error', 'Ansible 수집 예외', sanitizeLogDetail(e && e.message ? String(e.message) : null));
    }
  }

  const detailParts = [];
  if (cpuPct != null) detailParts.push('CPU ' + cpuPct + '%');
  if (memPct != null) detailParts.push('Mem ' + memPct + '%');
  if (tempC != null) detailParts.push('Temp ' + tempC + '°C');
  if (ifaceUp != null || ifaceDown != null) detailParts.push('Iface UP:' + (ifaceUp ?? 0) + '/DOWN:' + (ifaceDown ?? 0));
  if (inBps != null || outBps != null) detailParts.push('Traffic IN:' + (inBps ?? 0) + '/OUT:' + (outBps ?? 0));

  if (detailParts.length) {
    pushLog(a.device_id, 'info', '데이터 업데이트 완료', detailParts.join(', '));
  } else if (a.device_id) {
    pushLog(a.device_id, 'warn', '유효한 데이터 없음 (수집 실패)', null);
  }

  if (cpuPct != null) await queryClient.postTelemetrySnapshot(a.id, 'cpu', { cpu_pct: cpuPct }).catch((e) => { pushLog(a.device_id, 'warn', '스냅샷 저장 실패 (cpu)', e && e.message); });
  if (memPct != null) await queryClient.postTelemetrySnapshot(a.id, 'mem', { mem_pct: memPct }).catch((e) => { pushLog(a.device_id, 'warn', '스냅샷 저장 실패 (mem)', e && e.message); });
  if (tempC != null) await queryClient.postTelemetrySnapshot(a.id, 'temp', { temp_c: tempC }).catch((e) => { pushLog(a.device_id, 'warn', '스냅샷 저장 실패 (temp)', e && e.message); });
  if (ifaceUp != null || ifaceDown != null) await queryClient.postTelemetrySnapshot(a.id, 'iface', { up: Number(ifaceUp ?? 0), down: Number(ifaceDown ?? 0) }).catch((e) => { pushLog(a.device_id, 'warn', '스냅샷 저장 실패 (iface)', e && e.message); });
  if (inBps != null || outBps != null) await queryClient.postTelemetrySnapshot(a.id, 'traffic', { in_bps: inBps, out_bps: outBps }).catch((e) => { pushLog(a.device_id, 'warn', '스냅샷 저장 실패 (traffic)', e && e.message); });
}

async function collectAndStore() {
  try {
    const assets = await queryClient.getAssetsForTelemetry();
    pushLog(null, 'info', '수집 시작 (' + (assets && assets.length) + '대, 병렬 ' + CONCURRENCY + ')', null);
    if (!assets || assets.length === 0) {
      pushLog(null, 'info', '수집 완료 (대상 없음)', null);
      return;
    }
    for (let i = 0; i < assets.length; i += CONCURRENCY) {
      const chunk = assets.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((a) => processAsset(a)));
    }
    pushLog(null, 'info', '수집 완료', null);
  } catch (err) {
    pushLog(null, 'error', '수집 전체 실패', (err && err.message) || String(err));
    console.error('Telemetry collect:', err.message);
  }
}

function startTelemetryCollector() {
  if (intervalId) return;
  collectAndStore();
  intervalId = setInterval(collectAndStore, POLL_MS);
  console.log('Telemetry collector started, interval ms:', POLL_MS);
}

export { startTelemetryCollector, collectAndStore, getRecentLogs };

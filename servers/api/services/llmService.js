import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as ansibleService from './ansibleService.js';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(path.join(__dirname, '../../..'));

const DEVICE_ANSIBLE_MAP_PATHS = [
  path.join(PROJECT_ROOT, 'config', 'device-ansible-host.json'),
  path.join(process.cwd(), 'config', 'device-ansible-host.json')
];

let deviceAnsibleMapCache = null;

/** 장비명(device_id) → Ansible 인벤토리 호스트명. 매핑 없으면 hostname 그대로 반환. */
function resolveToAnsibleHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return hostname;
  const key = hostname.trim();
  if (!deviceAnsibleMapCache) {
    deviceAnsibleMapCache = {};
    for (const p of DEVICE_ANSIBLE_MAP_PATHS) {
      try {
        if (fs.existsSync(p)) {
          deviceAnsibleMapCache = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      } catch (_) {}
    }
  }
  return (deviceAnsibleMapCache[key] && String(deviceAnsibleMapCache[key]).trim()) || key;
}
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
const LLM_INTERPRET_SCRIPT = path.join(SCRIPTS_DIR, 'llm_interpret.py');
const LLM_SUMMARIZE_SCRIPT = path.join(SCRIPTS_DIR, 'llm_summarize.py');

const OLLAMA_DISABLED = process.env.OLLAMA_DISABLED === 'true';

function runPython(scriptPath, args, env) {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, ['-u', scriptPath].concat(args), {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONUNBUFFERED: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      logger.info('Python: ' + chunk.toString().trim());
    });
    proc.on('close', (code) => {
      if (code !== 0) logger.warn('Python 종료 코드: ' + code + ', stderr: ' + stderr.slice(0, 200));
      resolve({ code, stdout, stderr });
    });
    proc.on('error', (err) => {
      if (err.code === 'ENOENT' && pythonCmd === 'python3') {
        runPython(scriptPath, args, env).then(resolve).catch(reject);
        return;
      }
      reject(err);
    });
  });
}

async function getAvailableHosts() {
  try {
    const assets = await queryClient.getAssets();
    if (assets && assets.length > 0) {
      const seen = new Set();
      const list = [];
      for (const r of assets) {
        if (r.device_id && !seen.has(r.device_id)) {
          seen.add(r.device_id);
          list.push(r.device_id);
        }
      }
      return list;
    }
  } catch (_) {}
  return ['Router2', 'Router3'];
}

/** Ansible 연결 IP 정렬용 우선순위: 0=물리포트, 1=미지정, 2=SVI */
function interfacePriority(interfaceName) {
  const s = String(interfaceName || '').trim();
  if (!s) return 1;
  if (/VLAN|SVI/i.test(s)) return 2;
  if (/FastEthernet|GigaEthernet|Serial|Loopback/i.test(s)) return 0;
  return 1;
}

/** DB assets 기준 장비명(device_id) → IP 목록 매핑. 물리 포트 IP를 앞에 두어 Ansible 연결 시 우선 사용. */
async function getDeviceIpMap() {
  try {
    const assets = await queryClient.getAssets();
    if (!assets || assets.length === 0) return {};
    const byDevice = {};
    for (const r of assets) {
      if (!r.device_id || !r.ip || typeof r.ip !== 'string') continue;
      const ip = r.ip.trim();
      if (!ip) continue;
      if (!byDevice[r.device_id]) byDevice[r.device_id] = [];
      if (!byDevice[r.device_id].some(e => e.ip === ip)) {
        byDevice[r.device_id].push({ ip, interface_name: r.interface_name });
      }
    }
    const map = {};
    for (const [dev, list] of Object.entries(byDevice)) {
      list.sort((a, b) => interfacePriority(a.interface_name) - interfacePriority(b.interface_name));
      map[dev] = list.map(e => e.ip);
    }
    return map;
  } catch (_) {
    return {};
  }
}

async function interpretQuestion(question, availableHosts) {
  if (OLLAMA_DISABLED) return { hostname: 'Router2', command: 'show ip interface brief', error: 'Ollama 비활성화됨 (OLLAMA_DISABLED=true)' };
  const reachableHostsJson = JSON.stringify(Array.isArray(availableHosts) ? availableHosts : []);
  const deviceIpMapJson = JSON.stringify(await getDeviceIpMap());
  try {
    const { code, stdout, stderr } = await runPython(LLM_INTERPRET_SCRIPT, [question, reachableHostsJson, deviceIpMapJson]);
    const parsed = JSON.parse(stdout.trim() || '{}');
    const hostList = Array.isArray(availableHosts) ? availableHosts : [];
    const fallbackHost = hostList[0] || 'Router2';
    if (parsed.error) return { hostname: fallbackHost, command: 'show ip interface brief', error: parsed.error };
    let hostname = (parsed.hostname || '').toString().trim();
    if (!hostname) hostname = fallbackHost;
    if (hostList.length > 0 && !hostList.includes(hostname)) {
      const bbMatch = /router|라우터/i.test(hostname) && hostList.find(h => h.startsWith('BB_R'));
      hostname = bbMatch || hostList[0];
    }
    const action = (parsed.action || '').toString().trim().toLowerCase();
    const command = (parsed.command || 'show ip interface brief').toString().trim();
    if (action === 'cpu_memory' || action === 'temperature') return { hostname, action, raw: parsed.raw };
    if (!ansibleService.isCommandAllowed(command)) return { hostname, command: 'show ip interface brief', raw: parsed.raw };
    return { hostname, command, raw: parsed.raw };
  } catch (err) {
    const msg = err.message || String(err);
    logger.warn('LLM interpret error: ' + msg);
    return { hostname: 'Router2', command: 'show ip interface brief', error: msg };
  }
}

function isAnsibleRecapOutput(text) {
  return /PLAY RECAP|no hosts matched|skipping/i.test((text || '').trim());
}

async function summarizeOutput(question, command, outputText) {
  const raw = (outputText || '').trim();
  if (!raw || isAnsibleRecapOutput(raw)) {
    return null;
  }
  const payload = JSON.stringify({ question, command, outputText: raw.slice(0, 2000) });
  try {
    const { stdout } = await runPython(LLM_SUMMARIZE_SCRIPT, [payload]);
    return (stdout && stdout.trim()) || raw.slice(0, 500);
  } catch (err) {
    return raw.slice(0, 500);
  }
}

async function queryNetwork(question, options = {}) {
  const { summarize = true } = options;
  const hosts = await getAvailableHosts();
  const interpreted = await interpretQuestion(question, hosts);
  const { hostname, command, action, error: interpretError } = interpreted;
  if (interpretError) {
    return { success: false, error: 'LLM 해석 실패: ' + interpretError, hostname: null, command: null, output: null, summary: null };
  }
  const ansibleHost = resolveToAnsibleHost(hostname);
  const deviceIpMap = await getDeviceIpMap();
  const primaryIp = deviceIpMap[hostname]?.[0] || null;
  let ansibleResult;
  if (action === 'cpu_memory') {
    ansibleResult = await ansibleService.runGatherCpuMemory(ansibleHost);
  } else if (action === 'temperature') {
    ansibleResult = await ansibleService.runGatherTemperature(ansibleHost);
  } else {
    ansibleResult = await ansibleService.runShowCommand(
      ansibleHost,
      command || 'show ip interface brief',
      primaryIp ? { ansible_host: primaryIp } : undefined
    );
  }
  const displayCommand = command || (action === 'cpu_memory' ? 'CPU/메모리 수집' : action === 'temperature' ? '온도/환경 수집' : '');
  if (!ansibleResult.success) {
    const rawError = ansibleResult.error || 'Ansible 실행 실패';
    const stderr = ansibleResult.stderr || '';
    const noHostsMatch = /no hosts matched|skipping/i.test(rawError) || /no hosts matched|skipping/i.test(stderr);
    let error;
    if (noHostsMatch) {
      error = `장비(${hostname})를 Ansible 인벤토리에서 찾을 수 없습니다. device_id와 인벤토리 호스트 매핑(config/device-ansible-host.json)을 확인하세요.`;
    } else {
      const connFail = /Unable to connect to port 22|FAILED!/.test(rawError) || /Unable to connect to port 22/.test(stderr);
      let triedIp = primaryIp;
      if (!triedIp && (rawError || stderr)) {
        const m = (rawError + stderr).match(/on (\d+\.\d+\.\d+\.\d+)/);
        if (m) triedIp = m[1];
      }
      error = connFail
        ? `장비(${triedIp || hostname})에 SSH로 연결할 수 없습니다. 네트워크 연결과 인벤토리(ansible_host)를 확인하세요.`
        : rawError;
    }
    return {
      success: false,
      error,
      hostname,
      resolvedHost: ansibleHost,
      command: displayCommand,
      output: ansibleResult.stdout || null,
      summary: null
    };
  }
  const outputText = (ansibleResult.stdout || '').trim();
  const looksLikeAnsibleRecap = /PLAY RECAP|no hosts matched|skipping/i.test(outputText);
  const hasRealOutput = outputText.length > 0 && !looksLikeAnsibleRecap;
  let summary = null;
  if (summarize && hasRealOutput) summary = await summarizeOutput(question, displayCommand, outputText);
  return {
    success: true,
    hostname,
    resolvedHost: ansibleHost,
    command: displayCommand,
    output: outputText,
    summary: summary != null ? summary : (hasRealOutput && outputText ? outputText.slice(0, 500) : null)
  };
}

export { interpretQuestion, summarizeOutput, queryNetwork, getAvailableHosts };

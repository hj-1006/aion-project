import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as ansibleService from './ansibleService.js';
import * as db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

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

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const COMMAND_HINTS = [
  'show ip interface brief',
  'show ip int brief',
  'show interfaces',
  'show ip route',
  'show vlan',
  'show running-config',
  'show version',
  'show ip protocols',
  'show cdp neighbors',
  'show arp'
];

async function getAvailableHosts() {
  try {
    const rows = await db.query('SELECT device_id FROM assets ORDER BY device_id');
    if (rows && rows.length > 0) {
      const seen = new Set();
      return rows.filter(r => r.device_id && !seen.has(r.device_id) && (seen.add(r.device_id), true)).map(r => r.device_id);
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

/** DB assets 기준 장비명 → IP 목록. 물리 포트 IP를 앞에 두어 Ansible 연결 시 우선 사용. */
async function getDeviceIpMap() {
  try {
    const rows = await db.query('SELECT device_id, ip, interface_name FROM assets WHERE ip IS NOT NULL AND TRIM(ip) != ""');
    if (!rows || rows.length === 0) return {};
    const byDevice = {};
    for (const r of rows) {
      if (!r.device_id) continue;
      const ip = (r.ip || '').toString().trim();
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

/**
 * Ask Ollama (LLaMA) to interpret user question -> { hostname, command }
 */
async function interpretQuestion(question, availableHosts) {
  const hostList = Array.isArray(availableHosts) && availableHosts.length ? availableHosts : ['Router2', 'Router3'];
  const hosts = hostList.join(', ');
  const defaultHost = hostList[0];
  const deviceIpMap = await getDeviceIpMap();
  const deviceIpLines = Object.keys(deviceIpMap)
    .sort()
    .filter(dev => (deviceIpMap[dev] || []).length)
    .map(dev => `${dev}: ${(deviceIpMap[dev] || []).join(', ')}`);
  const deviceIpBlock = deviceIpLines.length
    ? `\nDevice name to IP mapping (장비명 - IP, use hostname from this list):\n${deviceIpLines.join('\n')}\n`
    : '';

  const prompt = `You are a network automation assistant. The user will ask about network device info in Korean or English.

Available devices (hostnames): ${hosts}
${deviceIpBlock}
Allowed Cisco IOS show commands (reply with EXACT text): ${COMMAND_HINTS.join(', ')}

User question: "${(question || '').trim()}"

Reply with ONLY a JSON object, no other text:
{"hostname": "device_name", "command": "show ..."}

Rules: Use ONLY a hostname from the device list above. Never use "Router2" or "Router3" unless they are in that list. For "BB router" or "BB 라우터" use BB_R1 or BB_R2. If unsure, use the first device: {"hostname": "${defaultHost}", "command": "show ip interface brief"}`;

  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2 }
    }, { timeout: 60000 });
    const text = (res.data && res.data.response) || '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { hostname: defaultHost, command: 'show ip interface brief', raw: text };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    let hostname = (parsed.hostname || '').toString().trim();
    if (!hostname) hostname = defaultHost;
    if (hostList.length > 0 && !hostList.includes(hostname)) {
      const bbMatch = /router|라우터/i.test(hostname) && hostList.find(h => h.startsWith('BB_R'));
      hostname = bbMatch || hostList[0];
    }
    const command = (parsed.command || 'show ip interface brief').toString().trim();
    if (!ansibleService.isCommandAllowed(command)) {
      return { hostname, command: 'show ip interface brief', raw: text };
    }
    return { hostname, command, raw: text };
  } catch (err) {
    console.error('LLM interpret error:', err.message);
    return { hostname: 'Router2', command: 'show ip interface brief', error: err.message };
  }
}

function isAnsibleRecapOutput(text) {
  return /PLAY RECAP|no hosts matched|skipping/i.test((text || '').trim());
}

/**
 * Optional: summarize Ansible output in natural language via LLM
 */
async function summarizeOutput(question, command, outputText) {
  const raw = (outputText || '').trim();
  if (!raw || isAnsibleRecapOutput(raw)) return null;

  const prompt = `네트워크 장비 조회 결과를 요약해주세요. 2~3문장으로 한국어로 답변.

질문: ${question}
실행 명령: ${command}

출력:
${raw.slice(0, 2000)}

요약:`;

  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.3 }
    }, { timeout: 30000 });
    return (res.data && res.data.response) || outputText;
  } catch (err) {
    return outputText;
  }
}

/**
 * Full flow: interpret -> resolve host -> Ansible run -> summarize only when real output
 */
async function queryNetwork(question, options = {}) {
  const { summarize = true } = options;
  const hosts = await getAvailableHosts();
  const { hostname, command, error: interpretError } = await interpretQuestion(question, hosts);
  if (interpretError) {
    return { success: false, error: `LLM 해석 실패: ${interpretError}`, hostname: null, command: null, output: null, summary: null };
  }
  const ansibleHost = resolveToAnsibleHost(hostname);
  const deviceIpMap = await getDeviceIpMap();
  const primaryIp = deviceIpMap[hostname]?.[0] || null;
  const ansibleResult = await ansibleService.runShowCommand(
    ansibleHost,
    command,
    primaryIp ? { ansible_host: primaryIp } : undefined
  );
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
      command,
      output: ansibleResult.stdout || null,
      summary: null
    };
  }
  const outputText = (ansibleResult.stdout || '').trim();
  const looksLikeAnsibleRecap = /PLAY RECAP|no hosts matched|skipping/i.test(outputText);
  const hasRealOutput = outputText.length > 0 && !looksLikeAnsibleRecap;
  let summary = null;
  if (summarize && hasRealOutput) {
    summary = await summarizeOutput(question, command, outputText);
  }
  return {
    success: true,
    hostname,
    resolvedHost: ansibleHost,
    command,
    output: outputText,
    summary: summary != null ? summary : (hasRealOutput && outputText ? outputText.slice(0, 500) : null)
  };
}

export { interpretQuestion, summarizeOutput, queryNetwork, getAvailableHosts };

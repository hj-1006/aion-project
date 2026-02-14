import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);
const ROOT = path.join(__dirname, '..', '..', '..');
const PLAYBOOKS_PATH = path.join(ROOT, 'ansible', 'playbooks');
const INVENTORY_PATH = path.join(ROOT, 'ansible', 'inventory', 'hosts.ini');

const ALLOWED_COMMANDS = [
  'show ip interface brief', 'show ip int brief', 'show interfaces', 'show ip route',
  'show vlan', 'show vlan brief', 'show running-config', 'show version',
  'show ip protocols', 'show cdp neighbors', 'show arp', 'show clock',
  'show processes cpu', 'show memory', 'show environment'
];

function isCommandAllowed(cmd) {
  const c = (cmd || '').trim().toLowerCase();
  return ALLOWED_COMMANDS.some(allowed => c.startsWith(allowed.toLowerCase()));
}

async function runShowCommand(hostname, command, options = {}) {
  if (!hostname || !command) throw new Error('hostname과 command가 필요합니다.');
  if (!isCommandAllowed(command)) throw new Error(`허용되지 않은 명령어입니다.`);
  if (!fs.existsSync(INVENTORY_PATH)) throw new Error('Ansible 인벤토리가 없습니다. ansible/inventory/hosts.ini를 생성하세요.');
  const playbookPath = path.join(PLAYBOOKS_PATH, 'show_command.yml');
  if (!fs.existsSync(playbookPath)) throw new Error('show_command.yml Playbook을 찾을 수 없습니다.');

  const env = { ...process.env, ANSIBLE_HOST_KEY_CHECKING: process.env.ANSIBLE_HOST_KEY_CHECKING || 'False', ANSIBLE_DEPRECATION_WARNINGS: 'False' };
  const tmpDir = path.join(ROOT, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const varsPath = path.join(tmpDir, `ansible-vars-${Date.now()}.json`);
  const vars = { hostname, command, ...(options.ansible_host && { ansible_host: options.ansible_host }) };
  fs.writeFileSync(varsPath, JSON.stringify(vars), 'utf8');
  const cmd = `ansible-playbook -i "${INVENTORY_PATH}" "${playbookPath}" -e "@${varsPath}"`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { env, maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    try { fs.unlinkSync(varsPath); } catch (_) {}
    return { success: true, stdout, stderr: stderr || '', output: null };
  } catch (err) {
    try { fs.unlinkSync(varsPath); } catch (_) {}
    return { success: false, error: err.message, stdout: err.stdout || '', stderr: err.stderr || '', output: null };
  }
}

async function runPlaybookLimitHost(playbookName, hostname) {
  if (!hostname) throw new Error('hostname이 필요합니다.');
  if (!fs.existsSync(INVENTORY_PATH)) throw new Error('Ansible 인벤토리가 없습니다. ansible/inventory/hosts.ini를 생성하세요.');
  const playbookPath = path.join(PLAYBOOKS_PATH, playbookName);
  if (!fs.existsSync(playbookPath)) throw new Error(playbookName + ' Playbook을 찾을 수 없습니다.');
  const env = { ...process.env, ANSIBLE_HOST_KEY_CHECKING: process.env.ANSIBLE_HOST_KEY_CHECKING || 'False', ANSIBLE_DEPRECATION_WARNINGS: 'False' };
  const cmd = `ansible-playbook -i "${INVENTORY_PATH}" "${playbookPath}" -l "${hostname}"`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { env, maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    return { success: false, error: err.message, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

async function runGatherCpuMemory(hostname) {
  return runPlaybookLimitHost('gather_cpu_memory.yml', hostname);
}

async function runGatherTemperature(hostname) {
  return runPlaybookLimitHost('gather_temperature.yml', hostname);
}

export { runShowCommand, runGatherCpuMemory, runGatherTemperature, isCommandAllowed, ALLOWED_COMMANDS };

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

const PLAYBOOKS_PATH = path.join(__dirname, '..', 'ansible', 'playbooks');
const INVENTORY_PATH = path.join(__dirname, '..', 'ansible', 'inventory', 'hosts.ini');

const ALLOWED_COMMANDS = [
  'show ip interface brief',
  'show ip int brief',
  'show interfaces',
  'show ip route',
  'show vlan',
  'show vlan brief',
  'show running-config',
  'show version',
  'show ip protocols',
  'show cdp neighbors',
  'show arp',
  'show clock',
  'show processes cpu',
  'show memory',
  'show environment'
];

function isCommandAllowed(cmd) {
  const c = (cmd || '').trim().toLowerCase();
  return ALLOWED_COMMANDS.some(allowed => c.startsWith(allowed.toLowerCase()));
}

async function runShowCommand(hostname, command, options = {}) {
  if (!hostname || !command) {
    throw new Error('hostname과 command가 필요합니다.');
  }
  if (!isCommandAllowed(command)) {
    throw new Error(`허용되지 않은 명령어입니다. 허용 예: ${ALLOWED_COMMANDS.slice(0, 5).join(', ')} ...`);
  }
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error('Ansible 인벤토리가 없습니다. ansible/inventory/hosts.ini.example을 복사해 hosts.ini를 생성하세요.');
  }
  const playbookPath = path.join(PLAYBOOKS_PATH, 'show_command.yml');
  if (!fs.existsSync(playbookPath)) {
    throw new Error('show_command.yml Playbook을 찾을 수 없습니다.');
  }

  process.env.ANSIBLE_HOST_KEY_CHECKING = process.env.ANSIBLE_HOST_KEY_CHECKING || 'False';
  const tmpDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const varsPath = path.join(tmpDir, `ansible-vars-${Date.now()}.json`);
  const vars = { hostname, command, ...(options.ansible_host && { ansible_host: options.ansible_host }) };
  fs.writeFileSync(varsPath, JSON.stringify(vars), 'utf8');
  const cmd = `ansible-playbook -i "${INVENTORY_PATH}" "${playbookPath}" -e "@${varsPath}"`;
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });
    const output = parseShowOutput(stdout);
    try { fs.unlinkSync(varsPath); } catch (_) {}
    return { success: true, stdout, stderr: stderr || '', output };
  } catch (err) {
    try { fs.unlinkSync(varsPath); } catch (_) {}
    return {
      success: false,
      error: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      output: null
    };
  }
}

function parseShowOutput(stdout) {
  const lines = (stdout || '').split('\n');
  let inOutput = false;
  const result = [];
  for (const line of lines) {
    if (line.includes('TASK [Set command output]') || line.includes('ok:') && line.includes('command_output')) {
      inOutput = true;
      continue;
    }
    if (inOutput && (line.startsWith('TASK [') || line.startsWith('PLAY RECAP'))) break;
    if (inOutput && line.trim()) result.push(line);
  }
  const fullText = (stdout || '').replace(/\r/g, '');
  const recap = fullText.match(/PLAY RECAP[\s\S]*/);
  return { lines: result, full: stdout, recap: recap ? recap[0] : null };
}

export { runShowCommand, isCommandAllowed, ALLOWED_COMMANDS };

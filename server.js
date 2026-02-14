import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import syslogRoutes from './routes/syslog.js';
import telemetryRoutes from './routes/telemetry.js';
import assetsRoutes from './routes/assets.js';
import llmRoutes from './routes/llm.js';
import requireAuth from './middleware/requireAuth.js';
import * as authService from './services/authService.js';
import { startSyslogServer } from './services/syslogServer.js';
import { startTelemetryCollector } from './services/telemetryCollector.js';
import { pool as dbPool } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: false, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aion-session-secret',
    resave: false,
    saveUninitialized: false,
    name: 'aion.sid',
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
  })
);

// Public: login page only
app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 루트 CA 배포 (경고 없이 접속용, 인증 불필요) ─────────────────
const ROOT_CA_PATH = path.join(__dirname, 'MyRootCA.pem');

app.get('/install-ca', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AION 루트 CA 설치</title></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 2rem auto; padding: 1rem;">
  <h1>🔒 AION 사이트 경고 없이 접속하기</h1>
  <p>아래에서 이 PC에 맞는 방법을 선택하세요. 한 번만 하면 이후 이 사이트 접속 시 경고가 사라집니다.</p>
  <h2>Windows</h2>
  <p><a href="${baseUrl}/api/ca/install.ps1" download="install-aion-root-ca.ps1" style="display:inline-block; padding:0.6rem 1rem; background:#0a6ed1; color:white; text-decoration:none; border-radius:6px;">Windows용 CA 설치 스크립트 다운로드</a></p>
  <p style="color:#555; font-size:0.9rem;">다운로드한 <strong>install-aion-root-ca.ps1</strong> 파일을 우클릭 → <strong>PowerShell에서 실행</strong> (관리자 권한 필요 시: PowerShell을 관리자로 연 뒤 <code>Set-ExecutionPolicy -Scope Process Bypass -Force; &amp; "다운로드경로\\install-aion-root-ca.ps1"</code>)</p>
  <h2>수동 설치 (모든 OS)</h2>
  <p><a href="${baseUrl}/api/ca/pem" download="AION-Root-CA.pem">루트 CA 파일 다운로드 (AION-Root-CA.pem)</a> 후, 브라우저/OS 인증서 저장소에 “신뢰할 수 있는 루트 인증 기관”으로 가져오기.</p>
  <p style="margin-top:2rem;"><a href="/">← 로그인 페이지로</a></p>
</body>
</html>`);
});

app.get('/api/ca/pem', (req, res) => {
  if (!fs.existsSync(ROOT_CA_PATH)) {
    return res.status(404).set('Content-Type', 'text/plain').send('MyRootCA.pem not found');
  }
  res.set('Content-Disposition', 'attachment; filename="AION-Root-CA.pem"');
  res.set('Content-Type', 'application/x-pem-file');
  res.sendFile(ROOT_CA_PATH);
});

app.get('/api/ca/install.ps1', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const pemUrl = `${baseUrl}/api/ca/pem`;
  const ps1 = `# AION Root CA - auto install (generated)
$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "관리자 권한으로 PowerShell을 실행한 뒤 다시 시도하세요." -ForegroundColor Red; exit 1 }
$pemUrl = "${pemUrl}"
$temp = [System.IO.Path]::GetTempFileName()
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $prev = [Net.ServicePointManager]::ServerCertificateValidationCallback
  [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  try { Invoke-WebRequest -Uri $pemUrl -OutFile $temp -UseBasicParsing } finally { [Net.ServicePointManager]::ServerCertificateValidationCallback = $prev }
  certutil.exe -addstore -f "Root" $temp
  Write-Host "AION 루트 CA가 설치되었습니다. 브라우저를 다시 연 뒤 접속하세요." -ForegroundColor Green
} finally { if (Test-Path $temp) { Remove-Item $temp -Force } }
`;
  res.set('Content-Disposition', 'attachment; filename="install-aion-root-ca.ps1"');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(ps1);
});

// API auth (no auth required for login)
app.use('/api/auth', authRoutes);

// Protected API
app.use('/api/syslog', requireAuth, syslogRoutes);
app.use('/api/telemetry', requireAuth, telemetryRoutes);
app.use('/api/assets', requireAuth, assetsRoutes);
app.use('/api/llm', requireAuth, llmRoutes);

function requireAdminPage(req, res, next) {
  if (!req.session || !req.session.user) return res.redirect('/');
  if (req.session.user.role !== 'admin') return res.redirect('/dashboard');
  return next();
}

// Protected pages (auth required) — 확장자 없이 URL 제공
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/syslog', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'syslog.html'));
});
app.get('/telemetry', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'telemetry.html'));
});
app.get('/ansible-dummy', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ansible-dummy.html'));
});
app.get('/llm-query', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'llm-query.html'));
});
app.get('/mail', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mail.html'));
});
/* 관리자 전용 제한 해제: requireAdminPage 주석 처리함 — 비관리자도 접근 가능 */
app.get('/device-config', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'device-config.html'));
});
app.get('/data-management', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'data-management.html'));
});
app.get('/accounts', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accounts.html'));
});
// .html 요청은 확장자 없는 URL로 리다이렉트
app.get('/dashboard.html', (req, res) => res.redirect(301, '/dashboard'));
app.get('/syslog.html', (req, res) => res.redirect(301, '/syslog'));
app.get('/telemetry.html', (req, res) => res.redirect(301, '/telemetry'));
app.get('/ansible-dummy.html', (req, res) => res.redirect(301, '/ansible-dummy'));
app.get('/llm-query.html', (req, res) => res.redirect(301, '/llm-query'));
app.get('/mail.html', (req, res) => res.redirect(301, '/mail'));
app.get('/device-config.html', (req, res) => res.redirect(301, '/device-config'));
app.get('/data-management.html', (req, res) => res.redirect(301, '/data-management'));
app.get('/accounts.html', (req, res) => res.redirect(301, '/accounts'));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Prometheus metrics (optional)
if (process.env.PROMETHEUS_METRICS_ENABLED === 'true') {
  try {
    const prom = await import('prom-client');
    const { register, collectDefaultMetrics } = prom.default || prom;
    collectDefaultMetrics();
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    });
  } catch (e) {
    // prom-client optional
  }
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || '서버 오류' });
});

const CREATE_USER_SESSIONS = `
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  username VARCHAR(64) NOT NULL,
  login_ip VARCHAR(64) DEFAULT NULL,
  login_user_agent TEXT,
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_ip VARCHAR(64) DEFAULT NULL,
  last_seen_user_agent TEXT,
  revoked_at DATETIME DEFAULT NULL,
  revoked_by INT DEFAULT NULL,
  revoked_reason VARCHAR(255) DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_username (username),
  INDEX idx_revoked (revoked_at)
)`;

const CREATE_LLM_QUERIES = `
CREATE TABLE IF NOT EXISTS llm_queries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  hostname VARCHAR(128) DEFAULT NULL,
  command_or_action VARCHAR(255) DEFAULT NULL,
  success TINYINT(1) DEFAULT NULL,
  output_preview TEXT DEFAULT NULL,
  summary TEXT DEFAULT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  username VARCHAR(64) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_created_at (created_at),
  INDEX idx_success (success)
)`;

async function start() {
  try {
    await authService.ensureDefaultAdmin();
  } catch (e) {
    console.warn('DB not ready, skipping default admin:', e.message);
  }
  try {
    await dbPool.execute(CREATE_USER_SESSIONS);
  } catch (e) {
    console.warn('user_sessions table ensure:', e.message);
  }
  try {
    await dbPool.execute(CREATE_LLM_QUERIES);
  } catch (e) {
    console.warn('llm_queries table ensure:', e.message);
  }
  startSyslogServer();
  startTelemetryCollector();

  const CERTS_DIR = path.join(__dirname, './ssl');
  const keyPath = path.join(CERTS_DIR, 'aion.key');
  const crtPath = path.join(CERTS_DIR, 'aion.crt');
  const httpsOptions = {
    cert: fs.readFileSync(crtPath),
    key: fs.readFileSync(keyPath),
    ciphers: [
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305'
    ].join(':'),
    honorCipherOrder: true,
    minVersion: 'TLSv1.2'
  };
  const host = process.env.HOST || '0.0.0.0';
  https.createServer(httpsOptions, app).listen(443, host, () => {
    console.log(`AION Mission Control https://${host}:443`);
  });
}

start().catch((err) => {
  console.error('Start failed:', err);
  process.exit(1);
});

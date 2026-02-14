import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PUBLIC_DIR = path.join(__dirname, '../../public');
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3001';
const PORT_HTTP = process.env.WEB_PORT || process.env.PORT || 80;
const PORT_HTTPS = process.env.WEB_PORT_HTTPS || 443;
const CERTS_DIR = path.join(__dirname, '../../ssl');

const app = express();
app.use(cors({ origin: true, credentials: true }));

// 루트 CA 배포 (경고 없이 접속용) — /api 프록시보다 먼저 등록
const ROOT_CA_PATH = path.join(__dirname, '../../MyRootCA.pem');

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
  <p style="color:#555; font-size:0.9rem;">다운로드한 <strong>install-aion-root-ca.ps1</strong>을 우클릭 → <strong>PowerShell에서 실행</strong> (관리자 권한 필요 시: PowerShell 관리자 실행 후 <code>Set-ExecutionPolicy -Scope Process Bypass -Force; &amp; "경로\\install-aion-root-ca.ps1"</code>)</p>
  <h2>수동 설치 (모든 OS)</h2>
  <p><a href="${baseUrl}/api/ca/pem" download="AION-Root-CA.pem">루트 CA 파일 다운로드 (AION-Root-CA.pem)</a> 후, 브라우저/OS 인증서 저장소에 신뢰할 수 있는 루트 인증 기관으로 가져오기.</p>
  <p style="margin-top:2rem;"><a href="/">← 처음으로</a></p>
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

app.use('/api', createProxyMiddleware({
  target: API_SERVER_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    const cookie = req.headers.cookie;
    if (cookie) proxyReq.setHeader('Cookie', cookie);
  },
  onProxyRes: (proxyRes, req) => {
    const path = req.originalUrl || req.url || '';
    console.log('[api] ' + (req.method || 'GET') + ' ' + path + ' -> ' + (proxyRes.statusCode || ''));
  }
}));

async function fetchAuthMe(req) {
  const cookie = req.headers.cookie || '';
  const res = await fetch(`${API_SERVER_URL.replace(/\/$/, '')}/api/auth/me`, {
    headers: { Cookie: cookie }
  });
  return res.json();
}

function requireAdminPage(req, res, next) {
  fetchAuthMe(req)
    .then((data) => {
      const role = data?.user?.role != null ? String(data.user.role).toLowerCase() : '';
      if (!data || !data.success || !data.user || role !== 'admin') {
        return res.redirect('/dashboard');
      }
      next();
    })
    .catch(() => res.redirect('/dashboard'));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/dashboard', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html')));
app.get('/syslog', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'syslog.html')));
app.get('/ansible-dummy', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'ansible-dummy.html')));
app.get('/llm-query', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'llm-query.html')));
/* 관리자 전용 제한 해제: requireAdminPage 주석 처리함 — 비관리자도 접근 가능 */
// app.get('/data-management', requireAdminPage, (req, res) => ...
app.get('/data-management', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'data-management.html')));
app.get('/mail', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'mail.html')));
// app.get('/accounts', requireAdminPage, (req, res) => ...
app.get('/accounts', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'accounts.html')));
app.get('/monitor', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'monitor.html')));
// app.get('/device-config', requireAdminPage, (req, res) => ...
app.get('/device-config', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'device-config.html')));
app.get('/dashboard.html', (req, res) => res.redirect(301, '/dashboard'));
app.get('/syslog.html', (req, res) => res.redirect(301, '/syslog'));
app.get('/ansible-dummy.html', (req, res) => res.redirect(301, '/ansible-dummy'));
app.get('/llm-query.html', (req, res) => res.redirect(301, '/llm-query'));
app.get('/data-management.html', (req, res) => res.redirect(301, '/data-management'));
app.get('/mail.html', (req, res) => res.redirect(301, '/mail'));
app.get('/accounts.html', (req, res) => res.redirect(301, '/accounts'));
app.get('/monitor.html', (req, res) => res.redirect(301, '/monitor'));
app.get('/device-config.html', (req, res) => res.redirect(301, '/device-config'));
app.use(express.static(PUBLIC_DIR, { index: false }));

const HOST = '0.0.0.0';

http.createServer(app).listen(PORT_HTTP, HOST, () => {
  console.log('AION Web Server http://' + HOST + ':' + PORT_HTTP + ' (API proxy -> ' + API_SERVER_URL + ')');
});


const keyPath = path.join(CERTS_DIR, 'aion.key');
const crtPath = path.join(CERTS_DIR, 'aion.crt');

const httpsOptions = {
  cert: fs.readFileSync(crtPath),
  key: fs.readFileSync(keyPath),
  // 브라우저와 암호 스위트 겹침 보장 (SSL_ERROR_NO_CYPHER_OVERLAP 방지)
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
https.createServer(httpsOptions, app).listen(PORT_HTTPS, HOST, () => {
  console.log('AION Web Server https://' + HOST + ':' + PORT_HTTPS);
});
 

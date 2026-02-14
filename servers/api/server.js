import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth.js';
import syslogRoutes from './routes/syslog.js';
import assetsRoutes from './routes/assets.js';
import telemetryRoutes from './routes/telemetry.js';
import llmRoutes from './routes/llm.js';
import mailRoutes from './routes/mail.js';
import accountsRoutes from './routes/accounts.js';
import dbRoutes from './routes/db.js';
import monitorRoutes from './routes/monitor.js';
import sessionsRoutes from './routes/sessions.js';
import requireAuth from './middleware/requireAuth.js';
import requireMailUser from './middleware/requireMailUser.js';
import requireAdmin from './middleware/requireAdmin.js';
import * as authService from './services/authService.js';
import { startSyslogServer } from './services/syslogServer.js';
import { startTelemetryCollector } from './services/telemetryCollector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { default: logger } = await import(pathToFileURL(path.resolve(__dirname, '../../lib/logger.js')).href);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const DEBUG_MAIL_LOG = path.join(__dirname, '../../debug-mail.log');

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'aion-session-secret',
  resave: false,
  saveUninitialized: false,
  name: 'aion.sid',
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) logger.error(msg);
    else if (res.statusCode >= 400) logger.warn(msg);
    else logger.info(msg);
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/syslog', requireAuth, syslogRoutes);
app.use('/api/assets', requireAuth, assetsRoutes);
app.use('/api/telemetry', requireAuth, telemetryRoutes);
app.use('/api/llm', requireAuth, llmRoutes);
app.use('/api/monitor', requireAuth, monitorRoutes);
app.use('/api/mail', (req, res, next) => {
  logger.info('[debug] /api/mail request', { method: req.method, path: req.path });
  try { fs.appendFileSync(DEBUG_MAIL_LOG, JSON.stringify({ t: Date.now(), method: req.method, path: req.path }) + '\n'); } catch (_) {}
  next();
});
app.use('/api/mail', requireAuth, requireMailUser, mailRoutes);
app.use('/api/accounts', requireAuth, requireAdmin, accountsRoutes);
app.use('/api/sessions', requireAuth, requireAdmin, sessionsRoutes);
app.use('/api/db', requireAuth, dbRoutes);

app.get('/health', (req, res) => res.json({ ok: true, service: 'api' }));

app.use((req, res) => {
  logger.warn('404 ' + (req.method || 'GET') + ' ' + (req.originalUrl || req.url));
  res.status(404).json({ success: false, message: 'Not Found' });
});

app.use((err, req, res, next) => {
  logger.error(err.message || err, { stack: err.stack });
  res.status(500).json({ success: false, message: err.message || '서버 오류' });
});

async function start() {
  try {
    await authService.ensureDefaultAdmin();
  } catch (e) {
    logger.warn('Query server not ready, skipping default admin: ' + e.message);
  }
  startSyslogServer();
  startTelemetryCollector();
  const host = process.env.HOST || '0.0.0.0';
  app.listen(PORT, host, () => {
    logger.info('AION API Server http://' + host + ':' + PORT);
  });
}

start().catch((err) => {
  logger.error('Start failed: ' + (err.message || err), { stack: err.stack });
  process.exit(1);
});

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import logger from '../../lib/logger.js';
import bodyParser from 'body-parser';
import usersRoutes from './routes/users.js';
import syslogRoutes from './routes/syslog.js';
import assetsRoutes from './routes/assets.js';
import dbRoutes from './routes/db.js';
import mailLogRoutes from './routes/mailLog.js';
import sessionsRoutes from './routes/sessions.js';
import llmQueriesRoutes from './routes/llmQueries.js';
import telemetryRoutes from './routes/telemetry.js';
import { pool } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

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

async function ensureUserSessionsTable() {
  try {
    await pool.execute(CREATE_USER_SESSIONS);
    logger.info('user_sessions table ready');
  } catch (err) {
    logger.warn('ensureUserSessionsTable: ' + (err.message || err));
  }
}

async function ensureLlmQueriesTable() {
  try {
    await pool.execute(CREATE_LLM_QUERIES);
    logger.info('llm_queries table ready');
  } catch (err) {
    logger.warn('ensureLlmQueriesTable: ' + (err.message || err));
  }
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/users', usersRoutes);
app.use('/syslog', syslogRoutes);
app.use('/assets', assetsRoutes);
app.use('/db', dbRoutes);
app.use('/mail-log', mailLogRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/llm-queries', llmQueriesRoutes);
app.use('/telemetry', telemetryRoutes);

app.get('/health', (req, res) => res.json({ ok: true, service: 'query-server' }));

app.use((err, req, res, next) => {
  logger.error(err.message || err, { stack: err.stack });
  res.status(500).json({ success: false, error: err.message });
});

async function start() {
  await ensureUserSessionsTable();
  await ensureLlmQueriesTable();
  app.listen(PORT, () => {
    logger.info('AION Query Server (MySQL) http://localhost:%s', PORT);
  });
}
start().catch((err) => {
  logger.error('Query server start failed: ' + (err.message || err), { stack: err.stack });
  process.exit(1);
});

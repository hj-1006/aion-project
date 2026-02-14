import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as llmService from '../services/llmService.js';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

/** 결과 명령/액션 기준 카테고리 (파인튜닝용) */
function getLlmQueryCategory(commandOrAction) {
  const cmd = String(commandOrAction || '').toLowerCase();
  if (/cpu|메모리|memory|온도|temperature|environment/.test(cmd)) return 'system';
  if (/show\s+ip\s+interface|show\s+interfaces/.test(cmd)) return 'interface';
  if (/show\s+run|show\s+version|configuration/.test(cmd)) return 'config';
  if (/show\s+vlan|vlan/.test(cmd)) return 'vlan';
  return 'general';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(path.join(__dirname, '../../..'));
const AI_QUERY_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'ai_query.py');

/**
 * project_2 /api/ask 스타일: Node는 Python만 실행, 로그=stderr, 결과=stdout JSON.
 */
function runAskPython(req, res) {
  const userMessage = (req.body && req.body.message) ? String(req.body.message).trim() : '';
  const reachableHosts = req.body && Array.isArray(req.body.reachableHosts) ? req.body.reachableHosts : [];
  const message = userMessage || 'Hello';
  const reachableHostsJson = JSON.stringify(reachableHosts);

  logger.info('============== [새 요청] ==============');
  logger.info('사용자: ' + message.slice(0, 80));
  logger.info('통신 가능 장비: ' + (reachableHosts.length ? reachableHosts.join(', ') : '없음'));

  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3'
  };

  let responded = false;
  const run = (pythonCmd) => {
    const pythonProcess = spawn(pythonCmd, ['-u', AI_QUERY_SCRIPT, message, reachableHostsJson], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let jsonBuffer = '';
    let stderrBuffer = '';

    pythonProcess.stdout.setEncoding('utf8');
    pythonProcess.stderr.setEncoding('utf8');

    pythonProcess.stdout.on('data', (data) => {
      jsonBuffer += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      const logMsg = data.toString().trim();
      const lines = logMsg.split('\n').filter(function (line) { return line.trim(); });
      lines.forEach(function (line) {
        if (line.trim()) {
          stderrBuffer += line + '\n';
          logger.info('Python: ' + line);
        }
      });
    });

    pythonProcess.stderr.on('error', (err) => {
      logger.error('stderr 에러: ' + err.message);
    });

    pythonProcess.on('close', (code) => {
      if (responded) return;
      responded = true;
      logger.info('Python 종료 (코드: ' + code + ')');

      if (code !== 0) {
        logger.warn('============== [실패 로그] ==============');
        logger.warn('종료 코드: ' + code);
        logger.warn('stderr: ' + stderrBuffer);
        logger.warn('stdout: ' + jsonBuffer.slice(0, 500));
      }

      const server_logs = {
        exit_code: code,
        stderr: stderrBuffer,
        stdout: jsonBuffer.length > 1000 ? jsonBuffer.substring(0, 1000) + '...' : jsonBuffer,
        stderr_lines: stderrBuffer.split('\n').filter(function (line) { return line.trim(); })
      };

      try {
        const jsonResponse = JSON.parse(jsonBuffer);
        jsonResponse.server_logs = server_logs;
        jsonResponse.logs = stderrBuffer.trim() || '(Python 로그 없음)';
        if (jsonResponse.success === undefined) jsonResponse.success = !jsonResponse.error;
        if (jsonResponse.response === undefined && jsonResponse.reply) jsonResponse.response = jsonResponse.reply;
        res.json(jsonResponse);
      } catch (e) {
        logger.error('JSON 파싱 실패: ' + e.message);
        res.status(500).json({
          success: false,
          error: 'AI 응답 처리 실패',
          details: jsonBuffer,
          logs: stderrBuffer.trim() || '(Python 로그 없음)',
          server_logs: {
            exit_code: code,
            stderr: stderrBuffer,
            stdout: jsonBuffer,
            parse_error: e.message
          }
        });
      }
    });

    pythonProcess.on('error', (err) => {
      if (err.code === 'ENOENT' && pythonCmd === 'python3') {
        run('python');
        return;
      }
      if (responded) return;
      responded = true;
      logger.error('프로세스 에러: ' + err.message);
      res.status(500).json({
        success: false,
        error: err.message,
        logs: stderrBuffer.trim() || ('spawn error: ' + err.message),
        server_logs: { exit_code: null, stderr: stderrBuffer, stdout: jsonBuffer }
      });
    });
  };

  run('python3');
}

router.post('/chat', (req, res) => {
  if (!(req.body && req.body.message != null)) {
    return res.status(400).json({ success: false, message: 'message(문자열)이 필요합니다.', response: null });
  }
  runAskPython(req, res);
});

router.post('/python-chat', (req, res) => {
  runAskPython(req, res);
});

router.post('/query', async (req, res) => {
  try {
    const { question, summarize } = req.body || {};
    if (!question || typeof question !== 'string') return res.status(400).json({ success: false, message: 'question(문자열)이 필요합니다.' });
    const result = await llmService.queryNetwork(question.trim(), { summarize: summarize !== false });
    const user = req.session?.user;
    try {
      const category = getLlmQueryCategory(result.command);
      await queryClient.insertLlmQuery({
        question: question.trim(),
        category,
        hostname: result.hostname || null,
        command_or_action: result.command || null,
        success: result.success ? 1 : 0,
        output_preview: result.output ? String(result.output).slice(0, 4000) : null,
        summary: result.summary || null,
        user_id: user?.id || null,
        username: user?.username || null
      });
    } catch (saveErr) {
      logger.warn('LLM query save for fine-tuning: ' + (saveErr.message || saveErr));
    }
    res.json(result);
  } catch (err) {
    logger.error('LLM query error: ' + err.message);
    res.status(500).json({ success: false, error: err.message, output: null, summary: null });
  }
});

router.get('/hosts', async (req, res) => {
  try {
    const hosts = await llmService.getAvailableHosts();
    res.json({ success: true, hosts });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, hosts: [] });
  }
});

export default router;

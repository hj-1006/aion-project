import express from 'express';
import * as llmService from '../services/llmService.js';
import * as db from '../config/db.js';
const router = express.Router();

function getLlmQueryCategory(commandOrAction) {
  const cmd = String(commandOrAction || '').toLowerCase();
  if (/cpu|메모리|memory|온도|temperature|environment/.test(cmd)) return 'system';
  if (/show\s+ip\s+interface|show\s+interfaces/.test(cmd)) return 'interface';
  if (/show\s+run|show\s+version|configuration/.test(cmd)) return 'config';
  if (/show\s+vlan|vlan/.test(cmd)) return 'vlan';
  return 'general';
}

router.post('/query', async (req, res) => {
  try {
    const { question, summarize } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, message: 'question(문자열)이 필요합니다.' });
    }
    const result = await llmService.queryNetwork(question.trim(), { summarize: summarize !== false });
    const user = req.session?.user;
    try {
      const category = getLlmQueryCategory(result.command);
      await db.query(
        `INSERT INTO llm_queries (question, category, hostname, command_or_action, success, output_preview, summary, user_id, username)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          question.trim().slice(0, 65535),
          category,
          result.hostname || null,
          result.command || null,
          result.success ? 1 : 0,
          result.output ? String(result.output).slice(0, 4000) : null,
          result.summary || null,
          user?.id || null,
          user?.username || null
        ]
      );
    } catch (saveErr) {
      console.warn('LLM query save:', saveErr.message);
    }
    res.json(result);
  } catch (err) {
    console.error('LLM query error:', err);
    res.status(500).json({ success: false, error: err.message, output: null, summary: null });
  }
});

router.get('/hosts', async (req, res) => {
  try {
    const hosts = await llmService.getAvailableHosts();
    res.json({ success: true, hosts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, hosts: [] });
  }
});

export default router;

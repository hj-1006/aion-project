import express from 'express';
import * as queryClient from '../lib/queryClient.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sessions = await queryClient.getSessions(req.query || {});
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || '세션 조회 실패' });
  }
});

router.get('/:session_id', async (req, res) => {
  try {
    const session = await queryClient.getSession(req.params.session_id);
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || '세션 조회 실패' });
  }
});

router.post('/revoke', async (req, res) => {
  try {
    const { session_id, user_id, username, reason } = req.body || {};
    if (!session_id && !user_id && !username) {
      return res.status(400).json({ success: false, message: 'session_id 또는 user_id 또는 username이 필요합니다.' });
    }
    await queryClient.revokeSessions({
      session_id,
      user_id,
      username,
      revoked_by: req.session?.user?.id || null,
      revoked_reason: reason || 'forced_logout'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || '세션 강제 종료 실패' });
  }
});

export default router;

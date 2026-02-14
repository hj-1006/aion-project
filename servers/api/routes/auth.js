import express from 'express';
import * as authService from '../services/authService.js';
import { recordLogin, recordLogout } from '../services/sessionService.js';
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, message: 'username과 password를 입력하세요.' });
    const user = await authService.verifyPassword(username, password);
    if (!user) return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    req.session.user = user;
    req.session.save(async (err) => {
      if (err) return res.status(500).json({ success: false, message: '세션 저장 실패' });
      try { await recordLogin(req, user); } catch (_) {}
      res.json({ success: true, user: { username: user.username, display_name: user.display_name, email: user.email, role: user.role } });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/logout', async (req, res) => {
  try { await recordLogout(req, 'logout', req.session?.user?.id || null); } catch (_) {}
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('aion.sid');
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ success: false });
  res.json({ success: true, user: req.session.user });
});

export default router;

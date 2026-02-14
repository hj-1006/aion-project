import { ensureActiveSession } from '../services/sessionService.js';
import logger from '../../../lib/logger.js';

async function requireAuth(req, res, next) {
  const path = req.originalUrl || req.url || '';
  if (req.session && req.session.user) {
    const result = await ensureActiveSession(req);
    if (!result.ok) {
      logger.warn('auth skip: session revoked or invalid', { path });
      req.session.destroy(() => {});
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: '세션이 만료되었거나 강제 로그아웃되었습니다.' });
      }
      return res.redirect('/');
    }
    return next();
  }
  logger.info('auth skip: no session', { path });
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  res.redirect('/');
}

export default requireAuth;

/** 관리자(role === 'admin')만 통과 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }
  next();
}

export default requireAdmin;

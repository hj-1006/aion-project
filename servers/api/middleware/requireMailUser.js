/** 메일 사용 권한이 있는 사용자만 통과 (can_use_mail === true) */
function requireMailUser(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  if (!req.session.user.can_use_mail) {
    return res.status(403).json({ success: false, message: '메일 사용 권한이 없습니다.' });
  }
  next();
}

export default requireMailUser;

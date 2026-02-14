import express from 'express';
import bcrypt from 'bcrypt';
import * as queryClient from '../lib/queryClient.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

/** 계정 목록 (비밀번호 제외) */
router.get('/', async (req, res) => {
  try {
    const users = await queryClient.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    logger.error('accounts GET: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message || '목록 조회 실패' });
  }
});

/** 계정 추가 (아이디, 비밀번호, 사용자 정보) */
router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, email, can_use_mail, role } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '아이디와 비밀번호는 필수입니다.' });
    }
    const name = (username || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '아이디를 입력하세요.' });
    }
    const existing = await queryClient.getUserByUsername(name);
    if (existing) {
      return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const useMail = can_use_mail === true || can_use_mail === 1 || String(can_use_mail) === 'true' || String(can_use_mail) === '1';
    const allowedRoles = ['viewer', 'user', 'operator', 'admin'];
    const roleVal = (role && allowedRoles.includes(String(role).toLowerCase())) ? String(role).toLowerCase() : 'user';
    await queryClient.insertUser(name, hash, (display_name || '').trim() || null, (email || '').trim() || null, useMail, roleVal);
    res.status(201).json({ success: true, message: '계정이 추가되었습니다.' });
  } catch (err) {
    logger.error('accounts POST: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message || '계정 추가 실패' });
  }
});

/** 계정 수정 (비밀번호 제외: 표시 이름, 이메일, 메일 사용, 권한) */
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: '잘못된 계정 ID입니다.' });
    const { display_name, email, can_use_mail, role } = req.body || {};
    const useMail = can_use_mail === true || can_use_mail === 1 || String(can_use_mail) === 'true' || String(can_use_mail) === '1';
    const allowedRoles = ['viewer', 'user', 'operator', 'admin'];
    const roleVal = (role !== undefined && role !== null && allowedRoles.includes(String(role).toLowerCase()))
      ? String(role).toLowerCase()
      : undefined;
    const data = {};
    if (display_name !== undefined) data.display_name = (display_name || '').trim() || null;
    if (email !== undefined) data.email = (email || '').trim() || null;
    if (can_use_mail !== undefined) data.can_use_mail = useMail;
    if (roleVal !== undefined) data.role = roleVal;
    if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: '수정할 항목이 없습니다.' });
    await queryClient.updateUser(id, data);
    res.json({ success: true, message: '수정되었습니다.' });
  } catch (err) {
    logger.error('accounts PATCH: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, message: err.message || '수정 실패' });
  }
});

export default router;

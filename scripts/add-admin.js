#!/usr/bin/env node
/**
 * 앱 로그인용 어드민 계정 생성 (Docker API 컨테이너에서 실행)
 * 사용: docker compose exec api node scripts/add-admin.js
 * 환경변수: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_DISPLAY_NAME
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const QUERY_SERVER_URL = (process.env.QUERY_SERVER_URL || 'http://query-server:3002').replace(/\/$/, '');

async function main() {
  const username = process.env.ADMIN_USERNAME || 'myadmin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const displayName = process.env.ADMIN_DISPLAY_NAME || 'My Admin';

  const hash = await bcrypt.hash(password, 10);
  await axios.post(`${QUERY_SERVER_URL}/users`, {
    username,
    password_hash: hash,
    display_name: displayName
  });
  console.log(`어드민 계정 생성됨: ${username} / (비밀번호: 입력하신 값)`);
}

main().catch((err) => {
  if (err.response?.status === 500 && /Duplicate entry/.test(err.response?.data?.error || '')) {
    console.error('이미 존재하는 사용자명입니다. 다른 ADMIN_USERNAME 을 사용하세요.');
  } else {
    console.error(err.response?.data || err.message);
  }
  process.exit(1);
});

#!/usr/bin/env node
/**
 * 도커 올리기 전 로컬 테스트 준비
 * - .env 없으면 .env.example 복사 (Ollama 10.100.0.200 사용)
 * - npm install 실행 안 함 (직접 npm install 후 pm2 start)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const OLLAMA_SERVER = 'http://10.100.0.200:11434';

if (!fs.existsSync(envPath)) {
  let content = fs.readFileSync(examplePath, 'utf8');
  if (!content.includes('10.100.0.200')) {
    content = content.replace(
      /OLLAMA_URL=.*/,
      `OLLAMA_URL=${OLLAMA_SERVER}`
    );
  }
  fs.writeFileSync(envPath, content);
  console.log('.env 생성됨 (OLLAMA_URL=%s)', OLLAMA_SERVER);
} else {
  console.log('.env 이미 존재함. OLLAMA_URL=%s 로 설정되어 있는지 확인하세요.', OLLAMA_SERVER);
}

console.log('');
console.log('다음 순서로 로컬 테스트:');
console.log('  1. MySQL 실행 후 스키마 적용: mysql -u root -p < sql/schema.sql');
console.log('  2. npm install');
console.log('  3. pm2 start ecosystem.config.cjs');
console.log('  4. 브라우저 http://localhost:3000 → 로그인 후 LLM 네트워크 질의');
console.log('');
console.log('상세: docs/LOCAL-TEST.md');

# 도커 올리기 전 로컬 테스트

Ollama가 **다른 서버(10.100.0.200)** 에 있을 때, 이 PC에서 AION을 **도커 없이** 실행해 보는 방법입니다.

---

## 1. 사전 조건

- Node.js 18+
- MySQL 8 (로컬 또는 접속 가능한 주소)
- 이 PC에서 **10.100.0.200:11434** (Ollama) 접속 가능

---

## 2. MySQL 준비

```bash
# MySQL이 로컬에 있다면
mysql -u root -p < sql/schema.sql

# 또는 MySQL 클라이언트로 스키마 적용 후, 아래 .env 에서 MYSQL_HOST 등 설정
```

---

## 3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 다음을 확인·수정합니다.

- **MySQL** (query-server가 사용)
  - `MYSQL_HOST=localhost` (또는 MySQL 서버 IP)
  - `MYSQL_PORT=3306`
  - `MYSQL_USER=aion`
  - `MYSQL_PASSWORD=aion_secret`
  - `MYSQL_DATABASE=aion`

- **Ollama (원격 서버 10.100.0.200)**
  - `OLLAMA_URL=http://10.100.0.200:11434`
  - `OLLAMA_MODEL=llama3` (해당 서버에 있는 모델명으로 변경 가능)

- **Query Server / API / Web** (로컬 실행 시 보통 수정 불필요)
  - `QUERY_SERVER_URL=http://localhost:3002`
  - `API_SERVER_URL=http://localhost:3001`

---

## 4. 패키지 설치

```bash
npm install
```

---

## 5. 서비스 실행 (PM2 권장)

한 번에 query-server, api, web 을 띄우려면:

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

- **Query Server**: http://localhost:3002 (내부)
- **API**: http://localhost:3001 (내부)
- **Web**: http://localhost:3000 → 브라우저에서 접속

기본 로그인: `admin` / `admin123` (최초 기동 시 자동 생성될 수 있음, 없으면 `scripts/add-admin.js` 참고)

---

## 6. 터미널 3개로 개별 실행 (PM2 없을 때)

```bash
# 터미널 1 - Query Server
npm run start:query

# 터미널 2 - API (Ollama 10.100.0.200 사용하려면 이 터미널에서 .env 적용됨)
npm run start:api

# 터미널 3 - Web
npm run start:web
```

그 다음 브라우저에서 **http://localhost:3000** 접속.

---

## 7. Ollama 연결 확인

원격 Ollama(10.100.0.200)가 응답하는지 먼저 확인:

```bash
curl http://10.100.0.200:11434/api/tags
```

이 PC에서 실패하면 방화벽/네트워크를 확인하세요.

로컬에서 API가 해당 URL을 쓰는지 확인하려면:

```bash
# .env 에 OLLAMA_URL=http://10.100.0.200:11434 설정 후
node -e "
require('dotenv').config({ path: '.env' });
console.log('OLLAMA_URL', process.env.OLLAMA_URL);
const u = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
require('http').get(u + '/api/tags', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log('OK', d.slice(0,200))); }).on('error', e => console.error('FAIL', e.message));
"
```

---

## 8. 테스트 체크리스트

| 항목 | 확인 |
|------|------|
| MySQL 스키마 적용 | `mysql -u aion -p aion -e "SHOW TABLES;"` |
| Query Server 기동 | `curl -s http://localhost:3002/health` → `{"ok":true,...}` |
| API 기동 | `curl -s http://localhost:3001/health` → `{"ok":true,...}` |
| Web 접속 | 브라우저 http://localhost:3000 로그인 |
| LLM (Ollama 10.100.0.200) | 로그인 후 **LLM 네트워크 질의** 메뉴에서 질문 입력 |

---

## 9. 도커로 올릴 때

로컬 테스트가 끝나면, 같은 Ollama 서버를 쓰려면 **.env** 에만 넣으면 됩니다:

```bash
OLLAMA_URL=http://10.100.0.200:11434
OLLAMA_MODEL=llama3
```

그 다음:

```bash
docker compose up -d
```

`docker-compose.yml`의 api 서비스는 이미 `OLLAMA_URL: ${OLLAMA_URL:-...}` 로 되어 있어서, `.env`의 값이 적용됩니다.

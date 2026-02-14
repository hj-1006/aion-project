# AION 웹 프로젝트 기술 스택 정리

이 문서는 **AION (Aerospace Integrated Operations Network)** 웹 프로젝트에서 사용한 모든 기술을 정리합니다.  
**도커는 사용하지 않고**, 호스트에서 MySQL + Node.js(PM2)로 실행하는 구성을 기준으로 합니다.

---

## 1. 런타임·언어

| 기술 | 용도 | 비고 |
|------|------|------|
| **Node.js** | 백엔드 서버 전반 (Web, API, Query Server) | ES Module (`"type": "module"`) 사용 |
| **JavaScript (ES6+)** | 서버·클라이언트 로직 | async/await, fetch, import/export |
| **Python 3** | LLM 연동 스크립트 (Ollama 호출, 해석·요약) | `scripts/ai_query.py`, `llm_interpret.py`, `llm_summarize.py` |
| **Bash** | 백업·방화벽 등 운영 스크립트 | `scripts/backup.sh`, `scripts/open-firewall-ports.sh` |
| **PowerShell** | Windows 클라이언트용 루트 CA 설치 | `scripts/install-aion-root-ca.ps1` (및 동적 생성 스크립트) |

---

## 2. 백엔드 프레임워크·라이브러리 (Node.js)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| **express** | ^4.18.2 | 웹·API 라우팅, 미들웨어, 정적 파일 서빙 |
| **express-session** | ^1.17.3 | 세션 기반 로그인 (쿠키 `aion.sid`) |
| **body-parser** | ^1.20.2 | JSON·URL-encoded 요청 바디 파싱 |
| **cors** | ^2.8.5 | CORS 설정 (credentials 포함) |
| **dotenv** | ^16.3.1 | `.env` 환경 변수 로드 |
| **mysql2** | ^3.6.5 | MySQL 연결 풀·쿼리 (Promise 기반) |
| **bcrypt** | ^5.1.1 | 비밀번호 해시 저장·검증 |
| **axios** | ^1.6.2 | HTTP 클라이언트 (Query Server·Ollama API 호출 등) |
| **nodemailer** | ^6.10.1 | SMTP 메일 발송 |
| **winston** | ^3.11.0 | 로깅 (콘솔·파일, JSON 포맷) |
| **http-proxy-middleware** | ^2.0.6 | Web 서버 → API 서버 리버스 프록시 (`/api` → 3001) |
| **prom-client** | ^15.1.0 | Prometheus 메트릭 수집 (선택, `PROMETHEUS_METRICS_ENABLED=true`) |
| **net-snmp** | ^3.9.1 | SNMP 수집 (레거시/단일 서버용 telemetry, 선택 사용) |

---

## 3. 프로세스·아키텍처

| 기술 | 용도 |
|------|------|
| **PM2** | Node 프로세스 관리: `aion-query`(3002), `aion-api`(3001), `aion-web`(80/443) 3개 앱 동시 실행 |
| **마이크로서비스 구조** | Web(정적+프록시) → API(인증·비즈니스) → Query Server(MySQL 전용) 분리 |
| **Node 내장 모듈** | `https`, `http`, `fs`, `path`, `dgram`(UDP Syslog), `child_process`(exec/spawn: Ansible·Python·ping/traceroute) |

---

## 4. 데이터베이스

| 기술 | 용도 |
|------|------|
| **MySQL 8** | 관계형 DB (스키마: `sql/schema.sql`, 마이그레이션: `sql/migrations/`) |
| **mysql2 (Promise)** | Query Server·레거시 server.js에서 풀 연결·`execute`/`query` |
| **테이블** | users, assets, vlans, services, syslog_events, telemetry_snapshots, automation_logs, user_sessions, llm_queries, mail_log 등 |

---

## 5. 프론트엔드

| 기술 | 용도 |
|------|------|
| **HTML5** | 시맨틱 마크업, 다국어( lang="ko" ) |
| **CSS3** | 커스텀 스타일 (`public/css/styles.css`), 반응형·네비게이션 |
| **Vanilla JavaScript** | React/Vue 등 프레임워크 없음. `fetch` + `credentials: 'include'` 로 API 호출 |
| **SVG 스프라이트** | 아이콘 (`/icons/sprite.svg`) |
| **폼·이벤트** | `addEventListener`, `submit`, `click` 등으로 로그인·CRUD·LLM 질의 UI |

---

## 6. 인증·보안

| 기술 | 용도 |
|------|------|
| **세션 쿠키** | `express-session`, `aion.sid`, httpOnly, 24시간 |
| **bcrypt** | 비밀번호 해시 저장 |
| **HTTPS (TLS 1.2+)** | Node `https` 모듈, `ssl/aion.crt`, `ssl/aion.key` (자체 서명 또는 내부 CA) |
| **루트 CA 배포** | 브라우저 경고 제거용: `MyRootCA.pem` 다운로드, Windows용 PowerShell 설치 스크립트 동적 생성 |
| **미들웨어** | `requireAuth`, `requireAdmin`, `requireMailUser`, `ensureActiveSession` (세션 폐기 검사) |

---

## 7. 인프라·통신

| 기술 | 용도 |
|------|------|
| **Syslog (UDP)** | Node `dgram` UDP 소켓, 포트 5514, RFC 3164/5424 스타일 파싱 후 MySQL 저장 |
| **SNMP** | `net-snmp`로 장비 CPU 등 수집 (선택, 레거시 telemetry) |
| **HTTP/HTTPS** | Web: 80/443, API: 3001, Query: 3002 |
| **리버스 프록시** | Web 서버가 `/api` 요청을 API 서버(3001)로 프록시, 쿠키 전달 |

---

## 8. 자동화·운영

| 기술 | 용도 |
|------|------|
| **Ansible** | CLI 전용. Playbook: `gather_cpu_memory.yml`, `gather_temperature.yml` 등. 웹은 더미/연동 스크립트 경로만 제공 |
| **Ansible 인벤토리** | INI 형식 (`ansible/inventory/hosts.ini`), `ansible_connection=network_cli`, `ansible_network_os=ios` (Cisco IOS) |
| **Ansible Galaxy** | `cisco.ios` 컬렉션 (네트워크 장비 명령 실행) |
| **Node child_process** | `exec`로 ansible-playbook 실행, `spawn`으로 Python 스크립트·ping/traceroute 실행 |

---

## 9. LLM·AI

| 기술 | 용도 |
|------|------|
| **Ollama** | 로컬 LLM 서버 (호스트 또는 원격 서버, 예: 10.200.200.200:11434). Docker 미사용 시 별도 설치 |
| **Python ollama 라이브러리** | `scripts/requirements.txt`: `ollama>=0.3.0`. `ai_query.py` 등에서 Ollama Chat API 호출 |
| **Node axios** | API 서버에서 Ollama HTTP API 호출 (대안 경로) |
| **Node spawn** | API 서버가 `python3 -u scripts/ai_query.py ...` 실행해 자연어 해석·요약 결과 수신 |

---

## 10. 메일

| 기술 | 용도 |
|------|------|
| **Nodemailer** | SMTP 클라이언트. 내부망 SMTP 서버 또는 테스트용 Mailpit(도커 별도) 연동 |
| **환경 변수** | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (선택) |

---

## 11. 로깅·모니터링

| 기술 | 용도 |
|------|------|
| **Winston** | API·Query 서버 로그 (콘솔·파일, `logs/`, JSON) |
| **Prometheus (선택)** | `prom-client`, `/metrics` 엔드포인트. `prometheus.yml`로 scrape 설정 가능 (도커 프로파일 시) |

---

## 12. 스크립트·도구

| 구분 | 기술 | 파일 예시 |
|------|------|-----------|
| DB | MySQL 클라이언트 | `sql/schema.sql`, `sql/create-user.sql`, `sql/migrations/*.sql` |
| 운영 | Bash | `scripts/backup.sh`, `scripts/start-with-mysql.sh`, `scripts/open-firewall-ports.sh` |
| 클라이언트 | PowerShell | `scripts/install-aion-root-ca.ps1`, 동적 CA 설치 스크립트 |
| 시드·유틸 | Node.js | `scripts/add-admin.js`, `scripts/prepare-local-test.js`, `scripts/seed-assets-from-ip-sheet.js` |
| LLM | Python 3 | `scripts/ai_query.py`, `scripts/llm_interpret.py`, `scripts/llm_summarize.py` |

---

## 13. 설정·환경

| 항목 | 기술 |
|------|------|
| 환경 변수 | `.env` (dotenv), `.env.example` 템플릿 |
| PM2 설정 | `ecosystem.config.cjs` (query 3002, api 3001, web 80/443) |
| Ansible 설정 | `ansible/ansible.cfg` (inventory 경로, host_key_checking, command_timeout 등) |
| SSL/TLS | OpenSSL로 발급한 인증서 (`ssl/aion.crt`, `ssl/aion.key`), 루트 CA (`MyRootCA.pem`) |

---

## 14. 문서·기타

| 구분 | 내용 |
|------|------|
| 문서 | `docs/` 하위 Markdown (DATABASE.md, LLM-OLLAMA.md, RUN-WITHOUT-DOCKER.md, MAIL-SERVER-SETUP.md 등) |
| 버전 관리 | `.gitignore` (node_modules, .env, backups 등 제외) |
| 개발 도구 | `nodemon` (devDependencies, 로컬 개발 시 사용) |

---

## 요약 (한눈에 보기)

- **백엔드**: Node.js (Express, mysql2, bcrypt, axios, nodemailer, winston, http-proxy-middleware, prom-client, net-snmp)
- **프론트엔드**: HTML5 + CSS3 + Vanilla JavaScript (fetch API)
- **DB**: MySQL 8
- **실행**: PM2 (Web + API + Query Server), 도커 미사용
- **통신**: HTTPS(TLS 1.2+), UDP Syslog, SNMP(선택), HTTP 프록시
- **자동화**: Ansible (CLI), Node child_process (exec/spawn)
- **LLM**: Ollama + Python(ollama 라이브러리) 또는 Node(axios)
- **메일**: Nodemailer (SMTP)
- **로깅/메트릭**: Winston, Prometheus(prom-client, 선택)

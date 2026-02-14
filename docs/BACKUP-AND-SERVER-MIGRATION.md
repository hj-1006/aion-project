# AION 백업 및 서버 위치 변경 가이드

## 1. 백업 방법

### 전체 백업 (권장)
```bash
cd /root/다운로드/first   # 또는 프로젝트 루트
chmod +x scripts/backup.sh
# 줄바꿈 오류 시: sed -i 's/\r$//' scripts/backup.sh
./scripts/backup.sh
```
또는 한 줄로:  
`cd 프로젝트루트 && mkdir -p backups && tar --exclude=node_modules --exclude=.git --exclude=backups --exclude='*.log' --exclude=tmp --exclude=.cursor -czvf backups/aion-backup-$(date +%Y%m%d_%H%M%S).tar.gz .`
- 생성 위치: `프로젝트/backups/aion-backup-YYYYMMDD_HHMMSS.tar.gz`
- 포함: 소스코드, 설정, SQL, 문서, public, ansible 등
- 제외: `node_modules`, `.git`, `backups`, `*.log`, `tmp`, `.cursor`

### 수동 백업 시 포함할 것
| 항목 | 경로/설명 |
|------|-----------|
| 소스·설정 | `servers/`, `public/`, `lib/`, `config/`, `middleware/` |
| SQL | `sql/` (스키마, 마이그레이션, create-user) |
| 설정 | `.env` (비밀번호 등 보안 주의), `ecosystem.config.js` |
| 문서 | `docs/`, `README.md` |
| Ansible | `ansible/` |
| 스크립트 | `scripts/` |
| 인증서 | `certs/` (선택, 복사 시 보안 유의) |

### 복원
```bash
mkdir -p /새경로/first && cd /새경로/first
tar -xzvf /경로/to/aion-backup-YYYYMMDD_HHMMSS.tar.gz
npm install
# .env 수정 후 pm2 start ecosystem.config.js
```

---

## 2. 서버 위치를 바꿀 때 수정할 것

프로젝트를 **다른 서버**로 옮기거나 **설치 경로**를 바꿀 때 아래만 확인·수정하면 됩니다.  
코드 안의 `path.join(__dirname, ...)` 는 **실행 경로 기준**이라 폴더만 그대로 옮기면 수정할 필요 없습니다.

### 반드시 수정: `.env`

| 변수 | 설명 | 예시 (같은 서버) | 이전 시 수정 |
|------|------|------------------|--------------|
| `MYSQL_HOST` | MySQL 주소 | `localhost` 또는 `127.0.0.1` | 새 서버에서 MySQL이 다른 호스트면 해당 IP/도메인 |
| `MYSQL_PORT` | MySQL 포트 | `3306` | 변경한 경우만 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | DB 계정 | (현재 값 유지) | 새 DB 계정 쓰면 변경 |
| `QUERY_SERVER_URL` | 쿼리 서버 주소 (API가 호출) | `http://localhost:3002` | **다른 호스트**에서 API·Query 분리 시 `http://새서버IP:3002` |
| `API_SERVER_URL` | API 서버 주소 (웹이 프록시) | `http://localhost:3001` | **다른 호스트**에서 웹·API 분리 시 `http://새서버IP:3001` |
| `SMTP_HOST` | 메일 서버 주소 | `localhost` 또는 `127.0.0.1` | 메일 서버가 다른 호스트면 해당 IP/도메인 |
| `SMTP_PORT` | SMTP 포트 | `25` (또는 587) | 변경한 경우만 |
| `OLLAMA_URL` | LLM(Ollama) 주소 | `http://10.200.200.200:11434` | Ollama 서버가 바뀌면 해당 URL |
| `SESSION_SECRET` | 세션 암호화 키 | (랜덤 문자열 권장) | 서버 이전 시 새로 바꾸면 보안상 좋음 |

- **같은 서버에서 경로만 바꾸는 경우** (예: `/root/다운로드/first` → `/opt/aion`):  
  위 항목은 대부분 `localhost`/`127.0.0.1` 그대로 두면 됩니다.  
- **웹/API/Query/MySQL을 서버 여러 대로 나누는 경우**:  
  각 서비스가 접속하는 **상대 서버의 IP(또는 도메인)** 로 위 URL/호스트를 바꾸면 됩니다.

### 선택 수정: `ecosystem.config.js`

- `cwd: __dirname` 이므로 **프로젝트 루트에서** `pm2 start ecosystem.config.js` 하면 경로는 자동입니다.
- **다른 호스트**로 Query/API를 나눴을 때만, 해당 앱의 `env` / `env_production` 안에  
  `QUERY_SERVER_URL`, `API_SERVER_URL` 등을 `.env`와 맞게 넣어줍니다 (보통은 `.env`만 씀).

### 그 밖에 확인할 것

| 항목 | 설명 |
|------|------|
| **MySQL** | 새 서버에 DB 설치·마이그레이션 실행, `.env` 계정/호스트 일치 |
| **방화벽** | 80, 443, 3001, 3002, 3306, 5514 등 필요한 포트 개방 |
| **메일(Postfix 등)** | 새 서버에서 SMTP 서비스 사용 시 `SMTP_HOST`/`SMTP_PORT`와 일치하도록 설정 |
| **HTTPS 인증서** | `certs/` 복사했으면 경로 동일. 새 도메인 쓰면 인증서 재발급 후 `certs/` 교체 |
| **Ansible inventory** | `ansible/inventory/hosts.ini` 에 대상 서버 IP/호스트명 반영 |

---

## 3. 코드에서 고정 경로를 쓰는 부분 (참고)

다음은 모두 **프로젝트 디렉터리 기준 상대 경로**(`__dirname` 등)를 쓰므로,  
**프로젝트 폴더 전체를 그대로 옮기면** 서버/경로를 바꿀 때 수정할 필요 없습니다.

- `servers/*/server.js` → `.env` 로드: `path.join(__dirname, '../../.env')`
- `servers/web/server.js` → `public`, `certs`: `path.join(__dirname, '../../public')` 등
- `servers/api/services/llmService.js` → `scripts/`, Python 스크립트
- `servers/api/services/ansibleService.js` → `ansible/playbooks`, `ansible/inventory`
- `servers/api/routes/llm.js` → `scripts/ai_query.py`

즉, **설정은 `.env`(와 필요 시 ecosystem)** 에만 두고, 코드는 경로를 바꾸지 않아도 됩니다.

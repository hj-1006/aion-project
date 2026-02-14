# AION — Aerospace Integrated Operations Network

항공우주 관제 시나리오 기반 지능형 네트워크 자동화/자율 라우팅 실험 프로젝트입니다.

- **도커 없이 쌩으로 실행**: 이 서버에서 MySQL + Node만으로 실행 → [docs/RUN-WITHOUT-DOCKER.md](docs/RUN-WITHOUT-DOCKER.md)
- **폐쇄망**: 이미지·패키지는 인터넷 되는 PC에서 받아 옮긴 뒤 사용 → [docs/CLOSED-NETWORK.md](docs/CLOSED-NETWORK.md)
- **메인 서버 + AI 서버(10.100.0.200) 구성**: 메인 서버에서 할 일 정리 → [docs/MAIN-SERVER-SETUP.md](docs/MAIN-SERVER-SETUP.md)

**우리 구현 구성 요소**: MySQL 스키마·연동(`sql/schema.sql`, Query Server), Node.js 서버(API·Query Server·Web), Ansible Playbook·인벤토리(`ansible/`)는 이 프로젝트에서 직접 작성·구성한 부분입니다. 외부는 Docker 베이스 이미지·Caddy·CoreDNS·Ollama(10.100.0.200) 등만 사용합니다.

## 구성 (마이크로서비스)

| 서비스 | 포트 | 역할 |
|--------|------|------|
| **Web** | 3000 (내부) | 정적 파일 + `/api` 프록시 (Docker에서는 Caddy가 80/443으로 노출) |
| **Caddy** | 80, 443 | 리버스 프록시: HTTP(80)·HTTPS(443) → Web 3000 |
| **DNS** | 53 | CoreDNS: aion.re.kr, aion.com, aion.org → 서버 IP (내부망 전용, [DNS-SETUP.md](docs/DNS-SETUP.md)) |
| **API** | 3001 | 인증·세션, Syslog UDP 수신(5514), Telemetry 수집, LLM·Ansible 연동. DB 접근은 Query Server HTTP 호출 |
| **Query Server** | 3002 | MySQL 전용. 사용자/자산/Syslog/Telemetry CRUD API |
| **MySQL** | 3306 | DB (Docker 시 스키마 자동 적용) |

- **PM2**: 로컬에서 3개 Node 프로세스(web, api, query-server) 관리.
- **Docker**: 각 서비스를 컨테이너로 분리 실행.

## 도커 올리기 전 로컬 테스트 (Ollama 10.100.0.200 등 원격 서버 사용)

Ollama가 다른 서버(예: 10.100.0.200)에 있을 때, 이 PC에서 도커 없이 테스트하려면 → [docs/LOCAL-TEST.md](docs/LOCAL-TEST.md) 참고.  
준비: `npm run local-test:prepare` → `.env` 생성(없을 때) 후 `npm install` → `pm2 start ecosystem.config.js`.

---

## 로컬 실행 (마이크로서비스 + PM2)

1. MySQL 8 실행 후 스키마 적용:
   ```bash
   mysql -u root -p < sql/schema.sql
   ```
2. 환경 설정:
   ```bash
   cp .env.example .env
   # MYSQL_*, QUERY_SERVER_URL, API_SERVER_URL 확인 (로컬은 localhost)
   ```
3. 패키지 설치:
   ```bash
   npm install
   ```
4. **PM2로 3개 서비스 기동** (권장):
   ```bash
   pm2 start ecosystem.config.js
   # 상태 확인: pm2 status
   # 로그: pm2 logs
   ```
   또는 개별 실행:
   ```bash
   npm run start:query   # 터미널 1 (3002)
   npm run start:api     # 터미널 2 (3001, Syslog 5514)
   npm run start:web     # 터미널 3 (3000)
   ```
5. 브라우저: http://localhost:3000 — 기본 로그인: `admin` / `admin123`

## Docker 실행

```bash
# HTTPS 인증서(직접 발급) 사용 시: 최초 1회 ./scripts/gen-https-cert.sh 실행 후 up → [docs/HTTPS-CERT.md](docs/HTTPS-CERT.md)
docker compose up -d
# 웹: http://localhost (80) 또는 https://localhost (443)
# 도메인 접속(aion.com 등): 내부 DNS 설정 후 https://aion.com 사용 → [docs/DNS-SETUP.md](docs/DNS-SETUP.md) 참고
# 같은 LAN의 다른 PC: http://<이_PC_IP> 또는 https://<이_PC_IP> (방화벽에서 80·443 허용)
# Syslog 수신: UDP 5514 (api 컨테이너)
# MySQL: 호스트에서 접속 시 포트 3307 사용 (컨테이너 내부는 3306, 호스트 3306 충돌 방지)
```

- 웹 URL은 **.html 없이** 제공됩니다 (예: `/dashboard`, `/syslog`). 기존 `/dashboard.html` 요청은 `/dashboard`로 리다이렉트됩니다.

- **mysql** → **query-server** → **api** → **web** (내부 3000). 외부 접속은 **Caddy**가 80(HTTP)·443(HTTPS)으로 받아 web으로 전달.
- MySQL DB·테이블은 최초 기동 시 `sql/schema.sql`로 자동 생성. 기본 admin은 API 서버 기동 시 `authService.ensureDefaultAdmin()`에서 한 번만 INSERT (admin / admin123). [docs/DATABASE.md](docs/DATABASE.md) 참고.

Prometheus까지 기동하려면:

```bash
docker-compose --profile tsdb up -d
# Prometheus: http://localhost:9090
```

## 디렉터리 구조 (마이크로서비스)

- `ecosystem.config.js` — PM2 앱 정의 (aion-query, aion-api, aion-web)
- `caddy/Caddyfile` — Caddy 리버스 프록시 설정 (80·443 → web:3000)
- `servers/query-server/` — MySQL 전용. `config/db.js`, routes: users, syslog, telemetry, assets
- `servers/api/` — API 서버. `lib/queryClient.js`(Query Server HTTP 호출), routes, services (auth, syslog, telemetry, ansible, llm)
- `servers/web/` — 정적 서빙 + `/api` → API 서버 프록시
- `public/` — 로그인, 대시보드, syslog.html, telemetry.html, ansible-dummy.html, llm-query.html
- `sql/schema.sql` — MySQL DDL (Docker 시 자동 실행)
- `docs/DATABASE.md` — 테이블 구조 문서
- `ansible/` — Ansible Playbook, `ansible/README.md` 참고
- `server.js` — (레거시 단일 진입점, 마이크로서비스 전환 후 사용 안 함)

## Ansible (CLI 전용)

웹과 연동되지 않습니다. 터미널에서 직접 실행:

```bash
cd ansible
cp inventory/hosts.ini.example inventory/hosts.ini
# hosts.ini 편집 후
ansible-playbook -i inventory/hosts.ini playbooks/gather_cpu_memory.yml
ansible-playbook -i inventory/hosts.ini playbooks/gather_temperature.yml
```

웹의 **장비 메트릭** 페이지는 더미 데이터만 표시합니다.

## LLM 네트워크 질의 (Ollama/LLaMA)

자연어로 질문하면 Ollama(LLM)가 해석하고, Ansible로 해당 장비의 **포트·IP·VLAN** 등을 불러옵니다.

- **AI 모델은 Docker 안에 넣지 않고**, 호스트 또는 다른 PC에서 Ollama를 실행한 뒤 AION API가 그 주소로 접속하는 방식을 권장합니다. → 상세: [docs/LLM-OLLAMA.md](docs/LLM-OLLAMA.md)

1. **Ollama 설치 및 모델 다운로드** (호스트 또는 별도 PC):
   ```bash
   # 설치 후
   ollama pull llama3
   ollama serve   # 또는 systemctl start ollama
   ```
2. **Docker 사용 시**: API 컨테이너는 기본값으로 `OLLAMA_URL=http://host.docker.internal:11434` 를 사용합니다. Ollama를 **호스트**에서 실행하면 됩니다. Linux에서 host.docker.internal이 안 되면 `.env`에 `OLLAMA_URL=http://<호스트_IP>:11434` 설정.
3. **Ansible 인벤토리**: `ansible/inventory/hosts.ini` (hosts.ini.example 복사 후 편집)
4. 웹에서 **LLM 네트워크 질의** 메뉴 → 질문 입력 (예: "Router2 포트 정보 보여줘", "Router3 IP와 VLAN")

흐름: **질문** → LLM이 `hostname` + `show` 명령 해석 → Ansible `show_command.yml` 실행 → **출력 + LLM 요약** 반환.

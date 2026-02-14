# AION 웹 구성 및 기능 설명

이 문서는 AION 웹 애플리케이션의 **구성(아키텍처·URL·페이지)** 과 **기능**을 정리합니다.

---

## 1. 웹 구성 개요

### 1.1 3계층 구조

AION 웹은 **세 개의 Node.js 서비스**로 나뉘어 동작합니다. (PM2로 동시 기동, 도커 미사용)

```
[브라우저]
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Web 서버 (aion-web)  ·  포트 80(HTTP) / 443(HTTPS)      │
│  - 정적 파일 서빙 (public/)                              │
│  - /api/* → API 서버로 프록시 (쿠키 전달)                │
│  - 루트 CA 배포 (/install-ca, /api/ca/pem, .ps1)         │
└─────────────────────────────────────────────────────────┘
    │  /api/* 만 프록시
    ▼
┌─────────────────────────────────────────────────────────┐
│  API 서버 (aion-api)  ·  포트 3001                      │
│  - 인증·세션 (express-session)                           │
│  - Syslog UDP 수신 (5514), Telemetry 수집 백그라운드     │
│  - 비즈니스 로직: auth, syslog, assets, telemetry,       │
│    llm, mail, accounts, sessions, db, monitor            │
│  - DB 접근은 Query Server HTTP 호출                      │
└─────────────────────────────────────────────────────────┘
    │  QUERY_SERVER_URL (localhost:3002)
    ▼
┌─────────────────────────────────────────────────────────┐
│  Query 서버 (aion-query)  ·  포트 3002                   │
│  - MySQL 전용 CRUD API                                   │
│  - users, assets, syslog, telemetry, sessions, db 등    │
└─────────────────────────────────────────────────────────┘
    │
    ▼
  MySQL (3306)
```

- **브라우저**는 **Web 서버(80/443)** 에만 접속합니다.
- **HTML/JS/CSS/아이콘**은 Web 서버가 `public/` 에서 그대로 제공합니다.
- **모든 API 요청**은 `/api/...` 로 보내면 Web 서버가 **API 서버(3001)** 로 프록시하고, API 서버가 필요 시 **Query 서버(3002)** 를 호출합니다.

### 1.2 요청 흐름 예시

| 사용자 동작 | 흐름 |
|-------------|------|
| 로그인 | 브라우저 → Web(80) → `/api/auth/login` → API(3001) → authService·Query(3002) → MySQL |
| Syslog 목록 보기 | 브라우저 → Web → `/api/syslog/events` → API → Query → MySQL |
| 장비 목록 보기 | 브라우저 → Web → `/api/assets` → API → Query → MySQL |
| LLM 질문 | 브라우저 → Web → `/api/llm/chat` 또는 `/api/llm/python-chat` → API → Python/Ollama 또는 Node·Ollama |

---

## 2. URL 구조

### 2.1 페이지 URL (확장자 없음)

로그인 후 접근하는 화면은 **.html 없이** 제공됩니다. 예전 `.html` URL은 301 리다이렉트로 처리됩니다.

| URL | HTML 파일 | 설명 |
|-----|-----------|------|
| `/` | index.html | 로그인 페이지 (비로그인 진입점) |
| `/dashboard` | dashboard.html | 대시보드 (요약·빠른 링크) |
| `/syslog` | syslog.html | Syslog 이벤트 목록 |
| `/telemetry` | telemetry.html | Telemetry 스냅샷 목록 |
| `/ansible-dummy` | ansible-dummy.html | 장비 메트릭 (CPU/메모리/온도 등) |
| `/monitor` | monitor.html | 통신 확인 (ping/traceroute, 토폴로지 시각화) |
| `/llm-query` | llm-query.html | 로컬 AI 질문 (일반 채팅 + 네트워크 장비 원격 질의) |
| `/device-config` | device-config.html | 장비 설정 (자산 CRUD, 관리자 권한 시 편집) |
| `/data-management` | data-management.html | 데이터 관리 (DB 테이블 조회·페이징) |
| `/mail` | mail.html | 메일 (발송·수신 목록, can_use_mail 사용자만) |
| `/accounts` | accounts.html | 계정 관리 (관리자: 사용자 CRUD·세션 강제 종료) |
| `/install-ca` | (동적 HTML) | 루트 CA 설치 안내 (인증서 경고 제거용) |

### 2.2 API URL (인증 제외·제한 구분)

| 접두어 | 인증 | 권한 | 설명 |
|--------|------|------|------|
| `/api/auth` | 불필요 | - | 로그인·로그아웃·/me |
| `/api/ca/*` | 불필요 | - | CA pem·PowerShell 스크립트 다운로드 |
| `/api/syslog` | 로그인 | - | Syslog 이벤트·건수 |
| `/api/assets` | 로그인 | POST/PATCH/DELETE는 admin | 자산 CRUD |
| `/api/telemetry` | 로그인 | - | 스냅샷·수집 로그·자산 목록 |
| `/api/llm` | 로그인 | - | 채팅·Python 채팅·네트워크 질의 |
| `/api/monitor` | 로그인 | - | ping·traceroute |
| `/api/mail` | 로그인 | requireMailUser | 발송·수신 목록·상태 |
| `/api/accounts` | 로그인 | admin | 사용자 목록·추가·수정·비밀번호 변경 |
| `/api/sessions` | 로그인 | admin | 세션 목록·강제 로그아웃 |
| `/api/db` | 로그인 | - | 테이블 목록·테이블 데이터(페이징) |

---

## 3. 페이지별 기능

### 3.1 로그인 (`/`, index.html)

- **기능**: 아이디·비밀번호 입력 후 `/api/auth/login` 호출. 성공 시 세션 쿠키 저장, `/dashboard` 로 이동. 실패 시 메시지 표시.
- **인증**: 없음 (진입점).

### 3.2 대시보드 (`/dashboard`)

- **기능**: 로그인 사용자 환영 문구, Syslog 이벤트 건수 표시, Syslog/장비 메트릭/Telemetry 등으로 가는 카드 링크. 로그아웃 버튼.
- **API**: `GET /api/auth/me`, `GET /api/syslog/events/count`.

### 3.3 Syslog (`/syslog`)

- **기능**: Syslog 이벤트 목록 테이블 (수신 시각, 장비 ID, host_from, severity, 메시지). severity 필터, 새로고침 버튼.
- **API**: `GET /api/syslog/events?limit=100&severity=...`.
- **데이터**: API 서버가 UDP 5514로 수신한 Syslog를 Query 서버를 통해 MySQL `syslog_events` 에 저장한 데이터.

### 3.4 Telemetry (`/telemetry`)

- **기능**: Telemetry 스냅샷 목록 (수집 시각, device_id, metric_type, value_json). 새로고침.
- **API**: `GET /api/telemetry/snapshots?limit=50`.
- **데이터**: API 서버의 Telemetry 수집기(Ansible/스크립트 등)가 주기적으로 수집해 MySQL `telemetry_snapshots` 에 넣은 데이터.

### 3.5 장비 메트릭 (`/ansible-dummy`, ansible-dummy.html)

- **기능**: 자산(장비)별 메트릭 카드 표시. CPU·메모리·온도 링 게이지, 인터페이스 UP/DOWN, 트래픽(In/Out bps). 수집 로그 탭에서 최근 수집 로그 확인.
- **API**: `GET /api/telemetry/snapshots`, `GET /api/telemetry/assets`, `GET /api/telemetry/collection-logs`.
- **비고**: 실제 값은 API 서버의 Telemetry 수집기(Ansible 연동 등)가 주기적으로 넣은 데이터를 사용. “더미”라는 이름은 초기에는 웹이 Ansible 결과와 직접 연동되지 않았던 역사적 이유.

### 3.6 통신 확인 (`/monitor`)

- **기능**: 등록된 자산(장비)을 노드로 표시하고, 장비 선택 시 **ping**·**traceroute** 실행 결과 표시. RTT(ms)에 따른 색상, 트레이스 홉 경로 시각화.
- **API**: `GET /api/assets`, `GET /api/monitor/ping?ip=...`, `GET /api/monitor/traceroute?ip=...`.
- **권한**: 로그인 사용자.

### 3.7 로컬 AI 질문 (`/llm-query`)

- **기능**  
  - **일반 채팅 탭**: 자연어 입력 → Ollama(Python 또는 Node 경로)로 질의응답. “로그 포함” 옵션 시 Python stderr 등 디버그 로그 표시.  
  - **네트워크 장비 탭**: 자연어로 “Router2 포트 정보 보여줘” 등 입력 → LLM이 장비명·명령 해석 → Ansible로 해당 장비에 명령 실행 → 출력 + LLM 요약 표시.
- **API**: `POST /api/llm/chat`, `POST /api/llm/python-chat`, `POST /api/llm/ask` (네트워크 질의).
- **백엔드**: Python `scripts/ai_query.py` (Ollama), 또는 Node llmService + Ansible.

### 3.8 장비 설정 (`/device-config`)

- **기능**: 네트워크 자산(장비) 목록 테이블. **관리자(admin)** 만 목록·추가·수정·삭제 가능. device_id, IP, 타입(라우터/스위치/서버 등), role, location. 비관리자는 “권한 없음” 메시지.
- **API**: `GET /api/assets`, `POST /api/assets`, `PATCH /api/assets/:id`, `DELETE /api/assets/:id`.
- **권한**: 표시는 모두 가능, 편집은 admin만 (API에서 requireAdmin).

### 3.9 데이터 관리 (`/data-management`)

- **기능**: MySQL 테이블 목록 선택 후, 해당 테이블 데이터를 테이블 형태로 조회. limit·offset 페이징.
- **API**: `GET /api/db/tables`, `GET /api/db/table/:name?limit=&offset=`.
- **권한**: 로그인 사용자 (읽기 전용 UI).

### 3.10 메일 (`/mail`)

- **기능**:  
  - **발송**: 수신 주소·제목·본문 입력 후 전송. SMTP 설정 상태 배지 표시.  
  - **수신함(보낸/받은 목록)**: DB에 저장된 메일 로그를 탭으로 표시 (발송 기록·수신 기록).  
- **API**: `GET /api/mail/status`, `POST /api/mail/send`, `GET /api/mail/list` 등.
- **권한**: 로그인 + **can_use_mail** 이 허용된 사용자만 사용 가능. 그 외는 “메일 사용 권한 없음” 메시지.

### 3.11 계정 관리 (`/accounts`)

- **기능**: **관리자(admin)** 전용. 사용자 목록(아이디, 표시명, 역할, 이메일, 메일 사용 여부), 계정 추가·수정(표시명, 이메일, 역할, 메일 사용)·비밀번호 변경. 세션 목록 조회 및 **강제 로그아웃(세션 폐기)**.
- **API**: `GET /api/accounts`, `POST /api/accounts`, `PATCH /api/accounts/:id`, `GET /api/sessions`, `POST /api/sessions/revoke`.
- **권한**: admin만 목록·편집 가능. 비관리자는 “권한 없음” 메시지.

### 3.12 루트 CA 설치 (`/install-ca`)

- **기능**: HTTPS 자체/내부 인증서로 인한 브라우저 경고를 제거하기 위한 안내. Windows용 PowerShell 스크립트 다운로드, PEM 파일 수동 다운로드 링크 제공. 인증 불필요.

---

## 4. API 영역별 기능 요약

| API 영역 | 주요 엔드포인트 | 기능 |
|----------|-----------------|------|
| **auth** | POST /login, POST /logout, GET /me | 로그인·로그아웃·현재 사용자 정보 |
| **syslog** | GET /events, GET /events/count | 이벤트 목록·건수 (Query 또는 외부 Syslog URL) |
| **assets** | GET /, POST /, PATCH /:id, DELETE /:id | 자산 CRUD (PATCH/DELETE는 admin) |
| **telemetry** | GET /snapshots, GET /snapshots/count, GET /assets, GET /collection-logs | 스냅샷·자산·수집 로그 |
| **llm** | POST /chat, POST /python-chat, POST /ask | Ollama 채팅, Python 채팅, 네트워크 장비 질의(Ansible 연동) |
| **monitor** | GET /ping?ip=, GET /traceroute?ip= | ping·traceroute (서버에서 실행) |
| **mail** | GET /status, POST /send, GET /list 등 | SMTP 상태·발송·메일 로그 목록 |
| **accounts** | GET /, POST /, PATCH /:id, POST /:id/password | 사용자 CRUD·비밀번호 변경 (admin) |
| **sessions** | GET /, GET /:session_id, POST /revoke | 세션 목록·상세·강제 폐기 (admin) |
| **db** | GET /tables, GET /table/:name | 테이블 목록·테이블 데이터 페이징 |

---

## 5. 인증·권한

- **세션**: `express-session`, 쿠키 이름 `aion.sid`, httpOnly, 24시간. 로그인 성공 시 `req.session.user` 에 사용자 정보 저장.
- **페이지 접근**: 로그인하지 않으면 대부분의 페이지에서 `/` 로 리다이렉트. API는 401 또는 리다이렉트.
- **역할(role)**: viewer, user, operator, admin. **admin** 만 계정 관리·장비 편집·세션 폐기 등 가능.
- **메일**: 사용자 테이블의 **can_use_mail** 이 true인 사용자만 `/api/mail` 사용 가능 (requireMailUser 미들웨어).
- **세션 폐기**: 관리자가 계정 관리에서 특정 세션 또는 사용자별 세션을 폐기하면, 해당 세션으로의 이후 요청 시 로그아웃 처리(ensureActiveSession).

---

## 6. 프론트엔드 공통 구조

- **레이아웃**: 모든 로그인 후 페이지는 상단 **app-header** (타이틀, 네비게이션, 사용자명·로그아웃) + **main.container** 구조.
- **네비게이션**: 모니터링(대시보드, Syslog, 장비 메트릭, 통신 확인) / AI·분석(로컬 AI 질문) / 관리(장비 설정, 데이터 관리, 메일, 계정 관리). `nav.js` 에서 아코디언·호버 처리. (관리자 전용 메뉴 숨김은 현재 주석 처리되어 비관리자에게도 노출 가능)
- **스크립트**: 각 페이지별 `js/*.js` (login.js, dashboard.js, syslog.js, telemetry.js, ansible-dummy.js, llm-query.js, device-config.js, data-management.js, mail.js, accounts.js, monitor.js). 공통으로 `nav.js` 포함. 인증 확인·로그아웃·사용자명 표시는 페이지마다 반복.
- **스타일·아이콘**: `public/css/styles.css`, `public/icons/sprite.svg` (SVG 스프라이트).

---

## 7. 정적 리소스

| 경로 | 설명 |
|------|------|
| `/css/styles.css` | 전역 스타일 |
| `/icons/sprite.svg` | 아이콘 스프라이트 (dashboard, syslog, mail 등) |
| `/js/*.js` | 페이지별 클라이언트 스크립트 |

---

이 문서는 `docs/TECH-STACK.md` 와 함께 보면, **어떤 기술로** 구현되었는지(TECH-STACK)와 **웹이 어떻게 구성되어 있고 어떤 기능을 하는지**(본 문서)를 한 번에 파악할 수 있습니다.

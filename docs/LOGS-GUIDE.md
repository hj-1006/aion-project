# 로그 해석 가이드

AION은 `./logs/` 아래에 다음 파일로 로그를 남깁니다.

| 파일 | 내용 |
|------|------|
| **api.log** | API 서버 일반 로그 (기동 메시지, 요청 등) |
| **api.error.log** | API 서버 **에러만** (Query Server 호출 실패, 예외 등) |
| **query-server.log** | Query Server 일반 로그 (기동 메시지 등) |
| **query-server.error.log** | Query Server **에러만** (MySQL 쿼리 실패 등) |

---

## 1. 흐름 이해

- **웹** → **API** → **Query Server** → **MySQL**
- Syslog/Telemetry 페이지에서 "조회 실패" 또는 500이 나오면:
  1. **api.error.log**: API가 Query Server를 호출했다가 **500**을 받았다는 뜻
  2. **query-server.error.log**: Query Server에서 **실제 원인** (대부분 MySQL 쿼리/연결 오류)

그래서 **원인 확인은 query-server.error.log를 먼저** 보면 됩니다.

---

## 2. 자주 나오는 에러와 대응

### query-server.error.log

| 메시지 | 의미 | 대응 |
|--------|------|------|
| `Incorrect arguments to mysqld_stmt_execute` | MySQL 쿼리 바인딩 인자 오류 (예: LIMIT ? 처리 문제) | 코드 수정됨. 이미지/코드 반영 후 재기동 |
| `connect ECONNREFUSED` | MySQL에 연결 못 함 | MySQL 컨테이너/프로세스 기동 여부, MYSQL_HOST/MYSQL_PORT 확인 |
| `ER_NO_SUCH_TABLE` | 테이블 없음 | 스키마 적용: `sql/schema.sql` 실행 |
| `syslog GET /events: ...` | Syslog 이벤트 조회 중 오류 | 위와 같이 MySQL/쿼리 원인 확인 |

### api.error.log

| 메시지 | 의미 | 대응 |
|--------|------|------|
| `syslog/events: Request failed with status code 500` | API가 Query Server `/syslog/events` 호출 시 500 수신 | **query-server.error.log** 에 실제 원인 있음 |
| `telemetry: Request failed with status code 500` | API가 Query Server `/telemetry/snapshots` 호출 시 500 수신 | 위와 동일 |
| `LLM 해석 실패: connect ECONNREFUSED` | Ollama(10.100.0.200) 연결 실패 | [docs/LLM-OLLAMA.md](LLM-OLLAMA.md) 참고, OLLAMA_URL·방화벽 확인 |

---

## 3. 정상일 때

- **api.log**: `AION API Server http://localhost:3001` 같은 기동 메시지
- **query-server.log**: `AION Query Server (MySQL) http://localhost:3002` 같은 기동 메시지
- **api.error.log**, **query-server.error.log**: 새 줄이 안 쌓이면 에러 없음

---

## 4. Docker 사용 시

로그는 호스트의 `./logs` 에 마운트되어 있으므로, 컨테이너 재시작해도 **같은 파일**에 이어서 쌓입니다.  
코드 수정 후 **이미지 재빌드**가 필요하면 폐쇄망 가이드대로 연결 PC에서 빌드·저장 후 옮겨서 `docker load` 하고 `docker compose up -d --no-build` 로 재기동하세요.

# Syslog — 다른 서버에서 가져오는 방법

Syslog 이벤트를 **외부 서버**에서 가져오도록 설정할 수 있습니다.  
`EXTERNAL_SYSLOG_URL` 환경 변수를 설정하면, API 서버는 query-server DB 대신 해당 URL로 요청을 **프록시**합니다.

## 설정

- **환경 변수**: `EXTERNAL_SYSLOG_URL`
- **예**: `https://syslog.example.com/api/syslog` (끝의 `/`는 자동 제거)
- 설정 시 `/api/syslog/events`, `/api/syslog/events/count` 요청이 이 URL로 전달됩니다.

## 외부 서버가 제공해야 할 API 스펙

Base URL을 `{BASE}`라고 할 때, 다음 두 엔드포인트를 제공해야 합니다.

### 1. 이벤트 목록

- **요청**: `GET {BASE}/events`
- **쿼리 파라미터** (선택):
  - `limit` — 최대 건수 (예: 100)
  - `severity` — 심각도 필터
  - `asset_id` — 장비 ID 필터
- **응답**: JSON
  - `success`: boolean
  - `events`: 배열 (각 항목 예시 아래 참고)

### 2. 이벤트 개수

- **요청**: `GET {BASE}/events/count`
- **응답**: JSON
  - `success`: boolean
  - `count`: number

### 이벤트 항목 필드 (권장)

| 필드         | 설명           |
|-------------|----------------|
| `received_at` | 수신 시각 (ISO 문자열 등) |
| `severity`    | 심각도         |
| `message`     | 로그 메시지    |
| `host_from`   | 발신 호스트    |
| `device_id`   | 장비 ID (선택) |

외부 서버가 위와 동일한 쿼리 파라미터와 `{ success, events }` / `{ success, count }` 형태로 응답하면, 프론트엔드 Syslog 화면이 그대로 동작합니다.

## 동작 요약

- `EXTERNAL_SYSLOG_URL` **없음** → 기존처럼 query-server DB에서 Syslog 조회
- `EXTERNAL_SYSLOG_URL` **있음** → 해당 URL로 `GET .../events`, `GET .../events/count` 요청을 보내고, 응답을 그대로 클라이언트에 반환

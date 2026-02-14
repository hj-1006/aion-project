# AION 데이터베이스 (MySQL) 테이블 구조

## 개요

AION은 MySQL을 **관계형 메타데이터 저장소(Source of Truth)**로 사용합니다.  
Docker Compose 사용 시 **MySQL 컨테이너 최초 기동 시** `sql/schema.sql`이 자동 실행되어 DB·테이블이 생성됩니다.  
**기본 관리자(admin)**는 테이블 생성 후 **Node.js 앱 기동 시** `authService.ensureDefaultAdmin()`에서 자동으로 한 번만 INSERT됩니다.

---

## DB 자동 설정 (Docker)

| 단계 | 내용 |
|------|------|
| 1 | `docker-compose up` 시 MySQL 컨테이너가 최초 기동되면 `docker-entrypoint-initdb.d/01-schema.sql` 실행 |
| 2 | `schema.sql`이 `aion` DB 생성 및 모든 테이블·인덱스 생성 |
| 3 | 앱 컨테이너는 MySQL healthcheck 통과 후 기동 |
| 4 | 앱 기동 시 `authService.ensureDefaultAdmin()`이 `users` 테이블이 비어 있으면 **admin** 계정 자동 생성 (비밀번호: `admin123`) |

**정리**: 테이블 구조와 인덱스는 스키마로 자동 생성되고, **초기 데이터는 admin 계정만** 앱에서 자동 삽입됩니다. 그 외 시드 데이터는 없습니다.

---

## 테이블 목록

| 테이블명 | 용도 |
|----------|------|
| users | 로그인용 운영자 계정 |
| assets | 네트워크 자산(장비) 정보 |
| vlans | VLAN/논리 구조 |
| services | 서비스·컨테이너 메타데이터 |
| syslog_events | Syslog 원본/요약 |
| telemetry_snapshots | Telemetry 스냅샷(메타/집계) |
| automation_logs | 자동화(Ansible 등) 실행 결과 |

---

## 1. users (로그인용 운영자)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | INT UNSIGNED | NO | PK, 자동 증가 |
| username | VARCHAR(64) | NO | 로그인 ID |
| password_hash | VARCHAR(255) | NO | bcrypt 해시 |
| display_name | VARCHAR(128) | YES | 표시 이름 |
| created_at | DATETIME | YES | 생성 시각 (기본 CURRENT_TIMESTAMP) |

**인덱스**: `PRIMARY KEY (id)`, `INDEX idx_username (username)`

---

## 2. assets (네트워크 자산)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | INT UNSIGNED | NO | PK, 자동 증가 |
| device_id | VARCHAR(64) | NO | 장비 식별자(예: Router2) |
| type | ENUM | NO | 'router', 'switch', 'other' (기본: router) |
| location | VARCHAR(128) | YES | 위치 |
| role | ENUM | NO | 'hq', 'research', 'datacenter', 'control', 'other' (기본: other) |
| ip | VARCHAR(45) | YES | IP 주소 |
| created_at | DATETIME | YES | 생성 시각 |

**인덱스**: `PRIMARY KEY (id)`, `INDEX idx_device_id (device_id)`, `INDEX idx_role (role)`, `INDEX idx_ip (ip)`

---

## 3. vlans (논리 구조)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | INT UNSIGNED | NO | PK, 자동 증가 |
| vlan_id | INT UNSIGNED | NO | VLAN 번호 |
| name | VARCHAR(64) | YES | VLAN 이름 |
| subnet | VARCHAR(64) | YES | 서브넷 |
| zone | VARCHAR(64) | YES | 존 |
| asset_id | INT UNSIGNED | YES | FK → assets(id), ON DELETE SET NULL |
| created_at | DATETIME | YES | 생성 시각 |

**인덱스**: `PRIMARY KEY (id)`, `FOREIGN KEY (asset_id)`, `INDEX idx_asset (asset_id)`

---

## 4. services (서비스/컨테이너 메타데이터)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | INT UNSIGNED | NO | PK, 자동 증가 |
| name | VARCHAR(128) | NO | 서비스 이름 |
| version | VARCHAR(32) | YES | 버전 |
| role | VARCHAR(64) | YES | 역할 |
| created_at | DATETIME | YES | 생성 시각 |

**인덱스**: `PRIMARY KEY (id)`  
(시드 데이터 없음, 필요 시 앱/스크립트에서 INSERT)

---

## 5. syslog_events (Syslog 원본/요약)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | BIGINT UNSIGNED | NO | PK, 자동 증가 |
| asset_id | INT UNSIGNED | YES | FK → assets(id), ON DELETE SET NULL |
| severity | VARCHAR(16) | YES | 심각도(0–7 등) |
| facility | VARCHAR(16) | YES | facility |
| message | TEXT | YES | 파싱된 메시지 |
| raw | TEXT | YES | 원본 로그 |
| host_from | VARCHAR(255) | YES | 발신 호스트/IP |
| received_at | DATETIME | YES | 수신 시각 (기본 CURRENT_TIMESTAMP) |
| indexed_at | DATETIME | YES | 인덱싱/분석 시각 |

**인덱스**: `PRIMARY KEY (id)`, `FOREIGN KEY (asset_id)`, `INDEX idx_received_asset (received_at, asset_id)`, `INDEX idx_severity (severity)`

---

## 6. telemetry_snapshots (Telemetry 스냅샷)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | BIGINT UNSIGNED | NO | PK, 자동 증가 |
| asset_id | INT UNSIGNED | NO | FK → assets(id), ON DELETE CASCADE |
| metric_type | ENUM | NO | 'cpu', 'mem', 'temp', 'interface' |
| value_json | JSON | YES | 메트릭 값(CPU%, 메모리%, 온도 등) |
| collected_at | DATETIME | YES | 수집 시각 (기본 CURRENT_TIMESTAMP) |

**인덱스**: `PRIMARY KEY (id)`, `FOREIGN KEY (asset_id)`, `INDEX idx_asset_collected (asset_id, collected_at)`

---

## 7. automation_logs (자동화 실행 결과)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| id | BIGINT UNSIGNED | NO | PK, 자동 증가 |
| playbook_name | VARCHAR(128) | YES | Playbook 이름 |
| extra_vars_json | JSON | YES | 실행 시 전달 변수 |
| result_summary | VARCHAR(512) | YES | 결과 요약 |
| executed_at | DATETIME | YES | 실행 시각 (기본 CURRENT_TIMESTAMP) |

**인덱스**: `PRIMARY KEY (id)`, `INDEX idx_executed (executed_at)`

---

## ER 관계 요약

- **vlans.asset_id** → assets.id (SET NULL)
- **syslog_events.asset_id** → assets.id (SET NULL)
- **telemetry_snapshots.asset_id** → assets.id (CASCADE)

---

## 참고

- 스키마 DDL: `sql/schema.sql`
- 기본 admin 생성: `services/authService.js` — `ensureDefaultAdmin()`

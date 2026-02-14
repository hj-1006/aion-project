# Docker에서 MySQL 접속 및 계정 생성

## 1. Docker 안에서 MySQL 접속하기

MySQL 컨테이너에 들어가서 `mysql` 클라이언트 실행:

```bash
# 프로젝트 루트에서
docker compose exec mysql mysql -u root -p
# 비밀번호: root_secret (docker-compose.yml의 MYSQL_ROOT_PASSWORD)
```

접속 후 DB 선택:

```sql
USE aion;
SHOW TABLES;
```

한 줄로 쿼리 실행:

```bash
docker compose exec mysql mysql -u root -proot_secret -e "USE aion; SELECT id, username, display_name FROM users;"
```

---

## 2. MySQL DB 사용자(계정) 생성

DB에 새 사용자를 만들고 권한 부여 (예: `myadmin` / 비밀번호 `mypass`):

```bash
docker compose exec mysql mysql -u root -proot_secret -e "
CREATE USER IF NOT EXISTS 'myadmin'@'%' IDENTIFIED BY 'mypass';
GRANT ALL PRIVILEGES ON aion.* TO 'myadmin'@'%';
FLUSH PRIVILEGES;
SELECT user, host FROM mysql.user WHERE user = 'myadmin';
"
```

이후 호스트에서 접속할 때 (포트 3307):

```bash
mysql -h 127.0.0.1 -P 3307 -u myadmin -p
# 비밀번호: mypass
```

---

## 3. 앱 로그인용 어드민 계정 생성

웹( http://localhost:3000 ) 로그인에 쓸 **앱 어드민 계정**은 `users` 테이블에 들어가며, 비밀번호는 bcrypt로 저장됩니다.  
스크립트로 생성하는 방법:

```bash
# 기본값: 사용자명 myadmin, 비밀번호 admin123, 표시이름 "My Admin"
docker compose exec api node scripts/add-admin.js
```

원하는 아이디/비밀번호로 만들려면 환경 변수로 넘깁니다:

```bash
docker compose exec -e ADMIN_USERNAME=내아이디 -e ADMIN_PASSWORD=내비밀번호 -e ADMIN_DISPLAY_NAME="내 이름" api node scripts/add-admin.js
```

예:

```bash
docker compose exec -e ADMIN_USERNAME=ops -e ADMIN_PASSWORD=Secret123! -e ADMIN_DISPLAY_NAME="운영자" api node scripts/add-admin.js
```

생성 후 http://localhost:3000 에서 해당 아이디/비밀번호로 로그인하면 됩니다.

---

## 요약

| 목적 | 명령 |
|------|------|
| MySQL 셸 접속 | `docker compose exec mysql mysql -u root -proot_secret` |
| DB 사용자 생성 | 위 2번 예시 SQL 실행 |
| 앱 어드민 계정 생성 | `docker compose exec api node scripts/add-admin.js` (환경변수로 아이디/비밀번호 지정 가능) |

기본 admin 계정(admin / admin123)은 앱 최초 기동 시 자동 생성됩니다. 추가 어드민은 위 3번 스크립트로 만듭니다.

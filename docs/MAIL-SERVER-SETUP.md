# 메일 서버 설정 안내

AION 앱에서 **메일 발송**을 쓰려면 **SMTP 서버**가 필요합니다. nodemailer는 그 서버에 접속해서 메일을 보내는 역할만 합니다.

---

## 1. Docker Compose로 실행할 때 (가장 간단)

이미 **메일 서비스(Mailpit)**가 포함되어 있습니다.

### 1) 전체 실행

```bash
cd /root/다운로드/first
docker compose up -d
```

`mail` 컨테이너가 함께 올라가고, API는 자동으로 `mail:1025`로 메일을 보냅니다.

### 2) 보낸 메일 확인

- 웹에서 **메일** 페이지 → 수신 주소 아무거나 입력 후 **발송**
- 브라우저에서 **http://localhost:8025** (또는 서버IP:8025) 접속
- Mailpit 웹 UI에서 방금 보낸 메일 내용 확인

| 항목 | 값 |
|------|-----|
| SMTP 주소 | `mail` (컨테이너 이름) / 포트 1025 |
| 웹 UI | http://localhost:8025 |

**참고:** Mailpit은 **테스트용**입니다. 보낸 메일을 실제 수신자에게 전달하지 않고, 웹 UI에서만 볼 수 있습니다. 내부망에서 “보내기 연동 테스트”용으로 쓰세요.

---

## 2. PM2(호스트)로 실행할 때

Docker 없이 `pm2 start ecosystem.config.js` 로 돌리는 경우, 아래 둘 중 하나를 하면 됩니다.

### 방법 A: Mailpit만 Docker로 띄우기 (테스트용)

1. 메일 서버만 실행:

```bash
docker run -d --name aion-mail \
  -p 1025:1025 -p 8025:8025 \
  axllent/mailpit:latest
```

2. `.env` 수정:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

3. API 재시작:

```bash
pm2 restart aion-api
```

4. 메일 발송 후 **http://localhost:8025** 에서 확인.

---

### 방법 B: 이 서버에 Postfix 설치 (실제 SMTP 서버)

내부망에서 **진짜 메일 서버**를 쓰려면 같은 서버에 Postfix를 설치합니다.

#### 1) 설치 (RHEL/CentOS/Rocky)

```bash
sudo dnf install -y postfix
# 또는
sudo yum install -y postfix
```

#### 2) 기본 설정 (로컬/내부 전용)

```bash
sudo postconf -e "inet_interfaces = localhost"
sudo postconf -e "mydestination = localhost.localdomain, localhost"
```

(내부망에서 다른 서버로 릴레이하려면 별도 relay 설정이 필요합니다.)

#### 3) 기동 및 부팅 시 자동 시작

```bash
sudo systemctl enable postfix
sudo systemctl start postfix
sudo systemctl status postfix
```

#### 4) 포트 확인

```bash
ss -tlnp | grep 25
```

25번 포트가 리스닝하면 정상입니다.

#### 5) `.env` 설정

```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
```

#### 6) API 재시작

```bash
pm2 restart aion-api
```

이후 웹 **메일** 페이지에서 발송 테스트하면, Postfix가 받아서 처리합니다 (로컬 전달 또는 relay 설정에 따름).

---

## 3. 보낸 메일이 웹 "메일함"에 안 보일 때

- **보낸 메일**은 DB `mail_log` 테이블에 저장되고, 메일 페이지 아래 **메일함** 목록에 표시됩니다.
- 목록에 안 보이면 `mail_log` 테이블이 없을 수 있습니다. 한 번만 실행하세요:
  ```bash
  mysql -u aion -p aion < sql/migrations/003_add_mail_log.sql
  ```
- API 서버 로그에 `Mail log save failed`가 보이면 위 마이그레이션 실행 후 `pm2 restart aion-query aion-api` 로 재시작하세요.

## 4. 정리

| 사용 방식 | 메일 서버 | .env SMTP 설정 |
|-----------|-----------|----------------|
| **Docker Compose** | Mailpit 자동 포함 | Docker 안 API가 `mail:1025` 사용 (이미 설정됨) |
| **PM2 + Mailpit** | `docker run ... mailpit` | SMTP_HOST=localhost, SMTP_PORT=1025 |
| **PM2 + Postfix** | `dnf install postfix` 후 기동 | SMTP_HOST=localhost, SMTP_PORT=25 |

- **수신자 메일함**(예: admin@aion.cisco.com)에 메일이 보이게 하려면 Postfix에서 해당 도메인/사용자로 전달되도록 설정해야 합니다. 로컬 사용자 메일은 서버에서 `mail` 명령으로 확인할 수 있습니다.

- **테스트만 할 때** → Docker Compose 또는 Mailpit만 띄우기.
- **실제 내부 메일 전달** → 같은 서버에 Postfix 설치 후 25번 포트 사용.

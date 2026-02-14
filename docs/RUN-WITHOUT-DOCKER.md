# 도커 없이 쌩으로 실행하기

이 서버에서 Docker 없이 **MySQL + Node.js 3개 서비스**만으로 AION을 띄우는 방법입니다.

---

## 1. MySQL 준비

MySQL 8이 이 서버에 설치·실행 중이어야 합니다.

```bash
# MySQL 서비스 확인 (systemd)
sudo systemctl status mysqld
# 꺼져 있으면
sudo systemctl start mysqld

cd /root/다운로드/first

# 1) MySQL 사용자 aion 생성 (비밀번호 aion_secret, .env와 동일해야 함)
mysql -u root -p < sql/create-user.sql

# 2) 스키마(테이블) 적용
mysql -u root -p < sql/schema.sql
```

**Access denied for user 'aion'@'localhost'** 가 나왔다면 → 위 `create-user.sql` 을 아직 안 돌린 상태입니다. 1번을 먼저 실행하세요.

---

## 2. .env 확인

```bash
cd /root/다운로드/first
test -f .env || cp .env.example .env
grep -E 'MYSQL_|QUERY_SERVER|API_SERVER|OLLAMA' .env
```

다음처럼 맞추면 됩니다 (MySQL 로컬, Ollama 10.100.0.200).

- `MYSQL_HOST=localhost`
- `MYSQL_PORT=3306`
- `MYSQL_USER=aion`
- `MYSQL_PASSWORD=aion_secret`
- `MYSQL_DATABASE=aion`
- `QUERY_SERVER_URL=http://localhost:3002`
- `API_SERVER_URL=http://localhost:3001`
- `OLLAMA_URL=http://10.100.0.200:11434`
- `OLLAMA_MODEL=llama3`

---

## 3. 패키지 설치

```bash
cd /root/다운로드/first
npm install
```

---

## 4. 서비스 실행

### 방법 A: PM2로 한 번에 (권장)

**MySQL 선기동 후 실행 (권장)** — 서버 재부팅 후 등 MySQL이 꺼져 있을 때:
```bash
cd /root/다운로드/first
chmod +x scripts/start-with-mysql.sh
./scripts/start-with-mysql.sh   # systemctl start mysqld 후 pm2 start
pm2 status
```

**또는 PM2만 실행** (MySQL이 이미 떠 있는 경우):
```bash
cd /root/다운로드/first
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

- **웹**: http://localhost:3000 (또는 이 서버 IP:3000)
- 로그인: `admin` / `admin123` (최초 기동 시 자동 생성, 없으면 `node scripts/add-admin.js` 실행)
- Node 앱은 PM2가 죽으면 자동 재기동. MySQL은 `systemctl enable mysqld` 로 부팅 시 자동 기동 가능.

중지: `pm2 stop all`  
다시 시작: `pm2 restart all`

### 방법 B: 터미널 3개로 개별 실행

**터미널 1 – Query Server**
```bash
cd /root/다운로드/first
npm run start:query
```
→ 3002 포트 대기

**터미널 2 – API**
```bash
cd /root/다운로드/first
npm run start:api
```
→ 3001, Syslog UDP 5514 대기

**터미널 3 – Web**
```bash
cd /root/다운로드/first
npm run start:web
```
→ 3000 포트 대기

브라우저에서 **http://localhost:3000** (또는 **http://이서버IP:3000**) 접속.

---

## 5. 확인

| 항목 | 확인 |
|------|------|
| Query Server | `curl -s http://localhost:3002/health` → `{"ok":true,...}` |
| API | `curl -s http://localhost:3001/health` → `{"ok":true,...}` |
| 웹 | 브라우저 http://localhost:3000 → 로그인 후 대시보드 |
| LLM | 로그인 → LLM 네트워크 질의 → 10.100.0.200 Ollama 사용 |

---

## 6. 로그

- **PM2**: `pm2 logs` (콘솔 출력)
- **파일 로그**: `./logs/api.log`, `./logs/api.error.log`, `./logs/query-server.log`, `./logs/query-server.error.log`  
  (환경 변수 `LOG_DIR` 이 설정되어 있으면 여기 저장)

---

## 7. 웹 포트 80 / 443 (도커처럼 쓰려면)

- **80 포트**: `.env`에 `WEB_PORT=80` 설정 후 `pm2 restart aion-web` (또는 `WEB_PORT=80 pm2 start ecosystem.config.js`).  
  **80 포트 바인딩은 root 권한이 필요**하므로 `sudo pm2 start ...` 또는 `setcap 'cap_net_bind_service=+ep' $(which node)` 후 일반 사용자로 실행.
- **443 포트(HTTPS)**: Node만으로 443을 쓰려면 HTTPS 서버 설정이 필요합니다. **권장**: 리버스 프록시(Caddy/nginx)를 80·443에 두고, 웹은 3000(또는 80)으로 두고 프록시만 80/443에서 받아 3000으로 넘깁니다. 도커의 Caddy와 같은 역할입니다.

요약: **80만 쓰려면** `WEB_PORT=80` + root 또는 setcap. **80·443 둘 다** 쓰려면 Caddy/nginx로 80·443 → 3000 프록시.

---

## 8. 방화벽 (다른 PC에서 접속할 때)

**같은 PC에서는 172.16.200.200 접속되는데, 외부 PC에서는 안 될 때** → 대부분 **방화벽**에서 80/443 포트가 막혀 있기 때문입니다.

웹 서버(aion-web)가 **80 포트**에서 동작할 때, 외부에서 `http://172.16.200.200` 접속을 허용하려면:

```bash
# 프로젝트 루트에서 한 번 실행 (firewalld 또는 ufw 자동 처리)
./scripts/open-firewall-ports.sh
```

또는 수동으로:

```bash
# firewalld (RHEL/CentOS/Rocky)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# ufw (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

이후 **외부 PC** 브라우저에서 `http://172.16.200.200` 으로 접속해 보세요.

(도커 없이 3000 포트만 쓸 때는 `sudo firewall-cmd --permanent --add-port=3000/tcp` 후 `--reload`.)

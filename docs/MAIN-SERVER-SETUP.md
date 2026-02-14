# 메인 서버(전체 관리용)에서 할 일

**구성**
- **이 서버 (메인)**: AION 실행 — 웹·API·Query Server·MySQL, 네트워크 장비 관리(Ansible), Syslog/Telemetry 수집  
  - MySQL 스키마·연동과 Node.js(API·Query Server·Web)는 **이 프로젝트에서 직접 구현**한 구성 요소입니다.
- **10.100.0.200**: AI 모델(Ollama) 전용 서버 — LLM 질의 시 이 주소로 연결

Ollama 연결(`curl http://10.100.0.200:11434/api/tags`)까지 확인했다면, 아래만 하면 됩니다.

---

## 1. Ollama 주소 고정

메인 서버에서 AION이 **10.100.0.200**으로 LLM 요청을 보내도록 설정합니다.

```bash
cd /root/다운로드/first   # 또는 프로젝트 경로

# .env 없으면 복사
test -f .env || cp .env.example .env

# Ollama 서버 주소 확인 (이미 되어 있으면 생략)
grep OLLAMA .env
# 다음처럼 되어 있으면 됨:
# OLLAMA_URL=http://10.100.0.200:11434
# OLLAMA_MODEL=llama3
```

다르면 편집:

```bash
# 필요 시 수정
sed -i 's|^OLLAMA_URL=.*|OLLAMA_URL=http://10.100.0.200:11434|' .env
sed -i 's|^OLLAMA_MODEL=.*|OLLAMA_MODEL=llama3|' .env
```

---

## 2. 실행 방법 선택

### A) 도커로 실행 (폐쇄망)

- 이미지는 **인터넷 되는 PC**에서 받아서 옮긴 뒤 사용합니다.  
  → [docs/CLOSED-NETWORK.md](CLOSED-NETWORK.md)

**이미 이미지 load까지 끝났다면, 메인 서버에서:**

```bash
cd /root/다운로드/first
docker compose up -d --no-build
```

- 웹: http://메인서버IP (80) 또는 https://메인서버IP (443)
- LLM: 웹 로그인 → **LLM 네트워크 질의** 메뉴에서 질문하면 10.100.0.200 Ollama 사용

---

### B) 로컬(PM2)로 실행

**이 메인 서버에서:**

```bash
cd /root/다운로드/first

# 1) MySQL 실행·스키마 적용 (아직 안 했다면)
mysql -u root -p < sql/schema.sql

# 2) 패키지 설치 (폐쇄망이면 연결 PC에서 node_modules 옮겨 둔 뒤 생략)
npm install

# 3) 서비스 기동
pm2 start ecosystem.config.js
pm2 status
```

- 웹: http://localhost:3000 (또는 메인 서버 IP:3000)
- 로그인 후 **LLM 네트워크 질의** → 10.100.0.200 Ollama 사용

---

## 3. 메인 서버에서 확인할 것

| 항목 | 확인 방법 |
|------|-----------|
| Ollama 연결 | `curl http://10.100.0.200:11434/api/tags` → JSON 나오면 OK (이미 확인함) |
| AION 웹 | 브라우저에서 http://메인서버IP 접속 후 로그인 |
| LLM | 로그인 → **LLM 네트워크 질의** 메뉴에서 질문 입력 → 응답 나오면 OK |
| Syslog 수신 | 장비에서 메인 서버 UDP 5514로 syslog 전송 설정 |
| Telemetry/장비 메트릭 | 자산 등록 후 수집기·Ansible 연동 |
| 네트워크 장비 Ansible | `ansible/inventory/hosts.ini` 에 장비 IP·계정 설정 후 playbook 실행 |

---

## 4. 요약 (메인 서버에서 할 일)

1. **OLLAMA_URL=http://10.100.0.200:11434** 인지 확인 (`.env`)
2. **Docker** 쓰면: 이미지 load 후 `docker compose up -d --no-build`
3. **PM2** 쓰면: MySQL + `npm install` + `pm2 start ecosystem.config.js`
4. 웹 접속 → 로그인 → **LLM 네트워크 질의**로 10.100.0.200 연결 확인
5. (선택) Ansible 인벤토리·Syslog/Telemetry 설정

이렇게 하면 메인 서버는 “전체 관리”, 10.100.0.200은 “AI 전용”으로 역할이 나뉜 상태로 동작합니다.

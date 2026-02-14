# LLM (Ollama) 연동

LLM 네트워크 질의는 **Ollama**가 해석한 뒤 Ansible로 장비 명령을 실행합니다.  
**AI 모델은 Docker 안에 넣지 않고**, 호스트 PC나 다른 서버에서 Ollama를 실행한 뒤 AION API가 그 주소로 접속하는 방식을 권장합니다.

---

## 1. Ollama 설치 및 모델 다운로드

Ollama는 **호스트 OS** 또는 **별도 PC/서버**에 설치합니다.

### 호스트(서버)에 설치

```bash
# Linux (curl 설치 스크립트)
curl -fsSL https://ollama.com/install.sh | sh

# 설치 후 서비스 기동 (systemd)
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 모델 다운로드 (같은 머신에서 한 번만)

```bash
# llama3 (권장, 약 2GB)
ollama pull llama3

# 또는 더 작은 모델
ollama pull llama3.2:3b
ollama pull phi3
```

모델은 `~/.ollama/models` (Linux) 등에 저장되며, 다른 곳에 미리 받아 둔 디렉터리를 쓰는 것도 가능합니다.

---

## 2. Docker에서 API가 Ollama에 접속하는 방법

AION API는 **Docker 컨테이너 안**에서 동작하므로, `localhost:11434`는 컨테이너 자신을 가리킵니다.  
**Ollama가 돌아가는 쪽 주소**를 환경 변수로 넘겨야 합니다.

### (A) Ollama를 AION과 같은 호스트에서 실행하는 경우

- `docker-compose.yml`에는 이미 다음이 들어가 있습니다.
  - `extra_hosts: host.docker.internal:host-gateway`
  - `OLLAMA_URL: http://host.docker.internal:11434`
- 호스트에서 Ollama만 실행하면 됩니다.

```bash
# 호스트에서 Ollama 실행 (이미 설치했다면)
ollama serve   # 또는 systemctl start ollama

# API 컨테이너만 재시작해도 됨
docker compose up -d api
```

- **Linux에서 `host.docker.internal`이 동작하지 않는 경우**  
  호스트 IP를 직접 지정합니다.

```bash
# .env 파일에 추가 (예: 호스트 IP가 10.10.0.101 인 경우)
OLLAMA_URL=http://10.10.0.101:11434
OLLAMA_MODEL=llama3

# 또는 실행 시 한 번만
OLLAMA_URL=http://10.10.0.101:11434 docker compose up -d
```

### (B) Ollama를 다른 PC/서버에서 실행하는 경우

- 그 PC에서 Ollama를 설치·실행하고, **방화벽에서 11434 포트**를 열어 둡니다.
- AION이 돌아가는 서버에서 그 PC의 **IP 또는 hostname**으로 접속할 수 있어야 합니다.

```bash
# .env 예시 (Ollama가 192.168.1.100 에 있는 경우)
OLLAMA_URL=http://192.168.1.100:11434
OLLAMA_MODEL=llama3
```

- Docker Compose는 `.env`의 변수를 읽으므로, 위처럼 설정한 뒤 `docker compose up -d` 하면 API가 해당 주소로 연결합니다.

---

## 3. Python ollama 라이브러리 (스크립트용)

질의응답·해석·요약은 **Python 스크립트**에서 수행하며, HTTP API가 아닌 **ollama 라이브러리**를 사용합니다.

```bash
pip install -r scripts/requirements.txt
# 또는
pip install ollama
```

스크립트는 `OLLAMA_URL`을 읽어 `OLLAMA_HOST`(host:port)로 변환한 뒤 `ollama.chat(model=..., messages=[...])` 로 호출합니다. 원격 Ollama 사용 시 `OLLAMA_URL`만 설정하면 됩니다.

## 4. 환경 변수 정리

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OLLAMA_URL` | `http://localhost:11434` (도커 기본: `http://host.docker.internal:11434`) | Ollama 주소 (Python에서 OLLAMA_HOST로 전달) |
| `OLLAMA_MODEL` | `llama3` | 사용할 모델 이름 (`ollama list` 로 확인) |
| `OLLAMA_DISABLED` | (없음) | `true` 로 두면 LLM 호출 비활성화 (연결 실패 시 기본 명령만 사용) |

---

## 5. 연결 확인

- 호스트(또는 Ollama 서버)에서:

```bash
curl http://localhost:11434/api/tags
```

- AION API 컨테이너에서:

```bash
docker exec aion-api node -e "
const u = process.env.OLLAMA_URL || 'http://localhost:11434';
require('http').get(u + '/api/tags', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log(d)); }).on('error', e => console.error(e.message));
"
```

---

## 5. 오류가 날 때

- **`connect ECONNREFUSED ::1:11434`**  
  - API가 여전히 `localhost`(컨테이너 자신)로 접속하고 있는 상태입니다.  
  - `OLLAMA_URL`을 **호스트 또는 Ollama 서버 주소**로 설정했는지 확인하세요. (Docker 사용 시 `http://host.docker.internal:11434` 또는 호스트 IP)
- **`Failed to connect to 10.100.0.200 port 11434: 연결이 거부됨`**  
  - **Ollama 서버(10.100.0.200)** 에서 아래를 순서대로 확인하세요. → [5-1. Ollama 서버(10.100.0.200) 점검](#5-1-ollama-서버-101000200-점검)
- **`connect ECONNREFUSED 192.168.x.x:11434`**  
  - 방화벽·네트워크에서 11434 포트가 막혀 있거나, 해당 IP에서 Ollama가 떠 있지 않을 수 있습니다.  
  - Ollama 서버에서 `ollama serve` 및 `curl http://localhost:11434/api/tags` 로 확인하세요.
- LLM을 쓰지 않고 기본 명령만 쓰고 싶다면 `.env`에 `OLLAMA_DISABLED=true` 를 두면 됩니다.

---

### 5-1. Ollama 서버(10.100.0.200) 점검

다른 PC에서 `curl http://10.100.0.200:11434/api/tags` 가 **연결이 거부됨**이면, **10.100.0.200 서버에 SSH로 접속**해서 아래를 확인하세요.

#### 1) Ollama가 실행 중인지

```bash
# 10.100.0.200 에서
sudo systemctl status ollama
# 또는
ps aux | grep ollama
```

꺼져 있으면:

```bash
sudo systemctl start ollama
# 또는 포그라운드로 테스트
OLLAMA_HOST=0.0.0.0 ollama serve
```

#### 2) 외부에서 접속받도록 바인딩

Ollama가 **127.0.0.1** 에만 바인딩되어 있으면 다른 PC에서 접속할 수 없습니다. **0.0.0.0** 으로 수신하도록 설정합니다.

```bash
# 10.100.0.200 에서 (systemd 사용 시)
sudo mkdir -p /etc/systemd/system/ollama.service.d
echo '[Service]
Environment="OLLAMA_HOST=0.0.0.0"' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

또는 수동 실행 시:

```bash
OLLAMA_HOST=0.0.0.0 ollama serve
```

#### 3) 방화벽에서 11434 포트 허용

```bash
# 10.100.0.200 에서 (firewalld)
sudo firewall-cmd --permanent --add-port=11434/tcp
sudo firewall-cmd --reload

# 또는 (iptables)
sudo iptables -A INPUT -p tcp --dport 11434 -j ACCEPT
```

#### 4) 같은 서버에서 먼저 확인

```bash
# 10.100.0.200 에서
curl http://localhost:11434/api/tags
```

여기서 성공하면 Ollama는 정상입니다. 그다음 **방화벽/바인딩(0.0.0.0)** 만 맞추면, AION이 있는 PC에서 `curl http://10.100.0.200:11434/api/tags` 도 성공해야 합니다.

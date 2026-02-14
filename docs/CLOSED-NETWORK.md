# 폐쇄망(오프라인) 환경 가이드

**전제: AION을 설치·운영하는 서버는 인터넷(Docker Hub, npm 레지스트리)에 접속할 수 없습니다.**

- Docker 이미지: **인터넷 되는 PC**에서 받아서 **이미지 파일로 옮긴 뒤** 폐쇄망 서버에서 `docker load`로 적재합니다.
- npm 패키지: **로컬 실행** 시에는 인터넷 PC에서 `npm install` 후 `node_modules`를 옮기거나, 미리 번들해 둔 패키지를 사용합니다.

---

## 1. 필요한 것

| 구분 | 설명 |
|------|------|
| **폐쇄망 서버** | AION이 실제로 돌아갈 서버 (Docker 또는 PM2 실행) |
| **연결 PC** | 인터넷(Docker Hub, npm) 접속 가능한 PC 1대 (이미지·패키지 받아서 옮기기용) |
| **이동 수단** | USB, SCP, 사내 파일 전송 등으로 `.tar` / 압축 파일을 폐쇄망 서버로 복사 |

---

## 2. Docker로 실행하는 경우 (권장)

폐쇄망에서는 **`docker compose build`를 하지 않고**, 연결 PC에서 미리 **이미지를 빌드·저장**한 뒤 옮겨서 `docker load` 후 `docker compose up` 합니다.

### 2-1. 연결 PC(인터넷 가능)에서 할 일

#### (1) 프로젝트 복사 후 베이스 이미지 받기

```bash
# 이 프로젝트가 있는 디렉터리로 이동
cd /path/to/first

# Docker 베이스 이미지 받기 (빌드에 필요)
docker pull node:18-alpine
docker pull mysql:8.0
docker pull coredns/coredns:1.11.1
```

#### (2) AION 앱 이미지 빌드 (같은 PC에서)

```bash
# api, query-server, web 이미지 빌드 (Dockerfile 사용)
docker compose build api query-server web

# Caddy 이미지 빌드 (caddy/ 디렉터리에 Dockerfile이 있는 경우)
docker compose build caddy
```

`caddy` 빌드가 실패하면(예: Dockerfile 없음) Caddy 대신 nginx 등 다른 리버스 프록시를 쓰거나, Caddy 이미지만 나중에 준비합니다.

#### (3) 이미지 저장 (파일로 내보내기)

**이미지 이름은 프로젝트 디렉터리 이름 기준입니다.** 예: 디렉터리가 `first` 이면 `first-api`, `first-query-server`, `first-web` 입니다.

```bash
# 저장할 디렉터리 (예: 현재 디렉터리의 상위)
mkdir -p ../aion-offline-images
cd ../aion-offline-images

# 베이스 이미지
docker save node:18-alpine -o node-18-alpine.tar
docker save mysql:8.0 -o mysql-8.0.tar
docker save coredns/coredns:1.11.1 -o coredns-1.11.1.tar

# AION 앱 이미지 (디렉터리 이름이 first 인 경우)
docker save first-api first-query-server first-web -o aion-app.tar

# Caddy 빌드했다면
docker save aion-caddy:latest -o aion-caddy.tar
```

실제 이름이 다르면 `docker images` 로 확인한 뒤 위에서 이름을 맞춰 주세요. (디렉터리 이름이 `aion` 이면 `aion-api` 등)

#### (4) 폐쇄망 서버로 파일 복사

- `node-18-alpine.tar`
- `mysql-8.0.tar`
- `coredns-1.11.1.tar`
- `aion-app.tar`
- (선택) `aion-caddy.tar`

위 파일들을 USB/SCP 등으로 **폐쇄망 서버**의 같은 디렉터리(예: `~/aion-offline-images`)에 복사합니다.

---

### 2-2. 폐쇄망 서버에서 할 일

#### (1) 프로젝트 배치

- AION 소스(`first` 폴더 전체)를 폐쇄망 서버에 둡니다.  
- 이미지 tar 파일들이 들어 있는 디렉터리(예: `~/aion-offline-images`)도 같은 서버에 있어야 합니다.

#### (2) 이미지 적재 (load)

```bash
cd ~/aion-offline-images   # tar 파일들이 있는 위치

docker load -i node-18-alpine.tar
docker load -i mysql-8.0.tar
docker load -i coredns-1.11.1.tar
docker load -i aion-app.tar
# Caddy 사용 시
docker load -i aion-caddy.tar
```

#### (3) 이미지 이름/태그 확인

`docker compose up` 은 `docker-compose.yml`에 적힌 **이미지 이름·태그**를 그대로 사용합니다.

- `build: .` 로 쓰는 서비스(api, query-server, web)는 **빌드된 이미지 이름**이 프로젝트 디렉터리 이름 기준입니다.  
  예: 프로젝트 폴더가 `first` 이면 `first-api`, `first-query-server`, `first-web` 입니다.
- **저장 시** 위 이름으로 저장했는지, **load 후** `docker images` 로 이름이 맞는지 확인하세요.  
  이름이 다르면 `docker tag 원본이름 목표이름` 으로 맞춘 뒤 `docker compose up` 합니다.

#### (4) 실행 (빌드 없이)

**폐쇄망에서는 반드시 `--no-build` 를 붙여** 빌드를 하지 않습니다.

```bash
cd /path/to/first
docker compose up -d --no-build
```

- `--no-build`: 이미지가 이미 있으면 빌드하지 않고, load 해 둔 이미지(`first-api`, `first-query-server`, `first-web` 등)를 그대로 사용합니다.
- MySQL, DNS는 `image:` 만 쓰므로 load만 하면 됩니다.
- Caddy는 `build` + `image: aion-caddy:latest` 이므로, 연결 PC에서 빌드한 뒤 `aion-caddy:latest` 를 save/load 해 두고 `--no-build` 로 기동합니다.

---

## 3. 이미지 이름이 다를 때 (compose 프로젝트명)

폐쇄망 서버에서 `docker compose up -d --no-build` 할 때 “이미지 없음”이 나오면, **실제 load된 이미지 이름**을 확인하세요.

- 이미지 이름은 **프로젝트 디렉터리 이름** 기준입니다. (`first` → `first-api`, `first-query-server`, `first-web`)
- 연결 PC에서 빌드·저장할 때 사용한 디렉터리 이름과, 폐쇄망 서버의 디렉터리 이름이 같으면 이름이 일치합니다.
- 이름이 다르면 load 후 `docker tag 원본이름 first-api` 처럼 태그를 맞춘 뒤 `docker compose up -d --no-build` 를 다시 실행하면 됩니다.

---

## 4. 로컬 실행(PM2) 시 npm 패키지 (폐쇄망)

Docker를 쓰지 않고 **PM2로 로컬 실행**할 때는 폐쇄망 서버에서 `npm install` 이 불가능하므로, **연결 PC에서 설치한 결과**를 옮깁니다.

### 방법 A: node_modules 통째로 복사

1. **연결 PC**에서:
   ```bash
   cd /path/to/first
   npm install
   tar czf node_modules.tar.gz node_modules
   ```
2. `node_modules.tar.gz` 와 `package.json`, `package-lock.json` 을 폐쇄망 서버로 복사.
3. **폐쇄망 서버**에서:
   ```bash
   cd /path/to/first
   tar xzf node_modules.tar.gz
   # package.json 등은 이미 복사되어 있다고 가정
   pm2 start ecosystem.config.js
   ```

### 방법 B: npm 캐시 + offline install

1. **연결 PC**에서 캐시 채우기:
   ```bash
   cd /path/to/first
   npm cache clean --force
   npm install
   ```
2. npm 캐시 디렉터리 압축 (Linux 예: `~/.npm/_cacache`) 후 폐쇄망 서버로 복사.
3. 폐쇄망 서버에서 `npm config set cache /path/to/cache` 후 `npm install --offline` (환경에 따라 가능).

---

## 5. Ollama / LLM

- Ollama는 **폐쇄망 내부의 다른 서버**(예: 10.100.0.200)에 두고, 그 서버에서 모델 파일을 미리 받아 두는 방식입니다.
- AION 서버는 **Ollama 서버 IP만 알면** 되므로, `.env` 에 `OLLAMA_URL=http://10.100.0.200:11434` 처럼 설정하면 됩니다.
- 모델 다운로드는 **연결 PC나 해당 Ollama 서버가 일시적으로 인터넷에 붙을 수 있을 때** 한 번만 받아 두면 됩니다. → [docs/LLM-OLLAMA.md](LLM-OLLAMA.md)

---

## 6. 요약 체크리스트 (폐쇄망 Docker)

| 단계 | 연결 PC(인터넷) | 폐쇄망 서버 |
|------|------------------|-------------|
| 1 | `docker pull node:18-alpine mysql:8.0 coredns/coredns:1.11.1` | - |
| 2 | `docker compose build api query-server web` (및 필요 시 caddy) | - |
| 3 | `docker save ... -o xxx.tar` 로 이미지 파일 생성 | - |
| 4 | tar 파일들 + AION 소스 복사 | tar, 소스 수신 |
| 5 | - | `docker load -i xxx.tar` 각각 실행 |
| 6 | - | `docker compose up -d` (빌드 없이 실행) |

이렇게 하면 **폐쇄망에서는 Docker Hub 접속 없이** AION을 Docker로 실행할 수 있습니다.

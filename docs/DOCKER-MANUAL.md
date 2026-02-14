# AION Docker 사용 매뉴얼

Docker 컨테이너 조회, 접속(들어가기), 중지, 삭제 방법을 정리했습니다.

---

## 1. 컨테이너 목록 보기

```bash
# 실행 중인 컨테이너만
docker ps

# 중지된 것 포함 전체
docker ps -a
```

예시 출력에서 **CONTAINER ID**(앞 12자만 써도 됨) 또는 **NAMES**로 컨테이너를 지정합니다.

---

## 2. 컨테이너 안에 “들어가기” (쉘/명령 실행)

**형식:** `docker exec [옵션] <컨테이너_이름_또는_ID> <실행할_명령>`

### 인터랙티브 쉘 (bash/sh)

```bash
# 컨테이너 이름으로 (AION 예시)
docker exec -it aion-api sh
docker exec -it first-mysql-1 bash

# 컨테이너 ID로 (앞 12자)
docker exec -it 5351def7f956 sh
```

- `-i`: 표준 입력 유지 (입력 가능)
- `-t`: 터미널(TTY) 할당
- 나갈 때: `exit` 또는 Ctrl+D

### 한 번만 명령 실행 (쉘 안 들어감)

```bash
docker exec aion-api node -v
docker exec first-mysql-1 mysql -u root -proot_secret -e "SELECT 1"
```

---

## 3. 컨테이너 중지하기

### 권장: 정상 종료 (stop)

```bash
# 이름으로
docker stop aion-api
docker stop first-mysql-1

# ID로
docker stop 5351def7f956

# 여러 개 한 번에
docker stop aion-api aion-web aion-query-server first-mysql-1
```

일정 시간 내 종료되지 않으면 자동으로 강제 종료됩니다.

### 강제 종료 (kill)

```bash
# 기본 시그널(SIGKILL)로 종료
docker kill aion-api
docker kill 5351def7f956
```

**주의:** `-s`는 “시그널 이름”을 받는 옵션입니다.

- 잘못된 예: `docker kill -s 514619d0a061`  
  → 514619d0a061이 시그널 이름으로 해석되고, 컨테이너 ID가 없어서 오류
- 올바른 예 (시그널 지정할 때):  
  `docker kill -s SIGTERM 514619d0a061`  
  → 시그널 SIGTERM, 컨테이너 ID 514619d0a061

시그널을 지정하지 않으면 그냥 **컨테이너 ID만** 쓰면 됩니다.

```bash
docker kill 514619d0a061
```

---

## 4. 컨테이너 삭제하기

**중지된 컨테이너만** 삭제할 수 있습니다. 실행 중이면 먼저 중지하거나 `-f`로 강제 삭제합니다.

```bash
# 1) 중지
docker stop first-mysql-1

# 2) 삭제
docker rm first-mysql-1
```

**한 번에 중지 + 삭제 (강제):**

```bash
docker rm -f first-mysql-1
docker rm -f aion-api aion-web aion-query-server first-mysql-1
```

`-f` = 실행 중이어도 강제로 중지한 뒤 삭제.

---

## 5. docker compose 로 AION 관리 (권장)

프로젝트 루트(`first/`)에서 실행합니다.

### 전체 실행 / 중지 / 삭제

```bash
cd /root/다운로드/first   # 프로젝트 루트

# 서비스 기동 (백그라운드)
docker compose up -d

# 서비스 중지 (컨테이너만 중지, 삭제 안 함)
docker compose stopup

# 서비스 중지 + 컨테이너 삭제 (볼륨은 유지)
docker compose down

# 서비스 중지 + 컨테이너 + 볼륨까지 삭제 (DB 데이터 삭제됨)
docker compose down -v
```

### 컨테이너 목록 / 로그

```bash
docker compose ps
docker compose logs -f        # 전체 로그 (실시간)
docker compose logs -f api    # api 서비스만
```

### compose로 “들어가기”

```bash
# api 컨테이너에 sh 로 들어가기
docker compose exec api sh

# mysql 클라이언트 실행
docker compose exec mysql mysql -u root -proot_secret
```

### compose로 특정 컨테이너만 중지/삭제

```bash
docker compose stop mysql
docker compose rm -f mysql    # 삭제 (재기동 시 다시 생성됨)
```

---

## 6. 이미지 삭제

컨테이너를 먼저 삭제한 뒤 이미지를 지울 수 있습니다.

```bash
# 사용 안 하는 이미지만 삭제
docker image prune

# AION 이미지 직접 삭제 (해당 이미지 쓰는 컨테이너 없어야 함)
docker rmi first-api first-web first-query-server
```

---

## 7. 자주 쓰는 명령 요약

| 하려는 것 | 명령 |
|-----------|------|
| 실행 중인 컨테이너 보기 | `docker ps` |
| 컨테이너 안 쉘 들어가기 | `docker exec -it <이름또는ID> sh` |
| 컨테이너 정상 종료 | `docker stop <이름또는ID>` |
| 컨테이너 강제 종료 | `docker kill <이름또는ID>` (옵션 없이 ID만) |
| 컨테이너 삭제 | `docker rm <이름또는ID>` (중지 후) 또는 `docker rm -f <이름또는ID>` |
| AION 전체 기동 | `docker compose up -d` |
| AION 전체 중지 | `docker compose stop` |
| AION 전체 중지+삭제 | `docker compose down` |
| AION 컨테이너에 들어가기 | `docker compose exec api sh` 등 |

---

## 8. 오류 해결

### "flag needs an argument: 's' in -s"

- `docker kill -s` 만 쓰면 `-s` 다음에 **시그널 이름**이 와야 합니다.
- **그냥 컨테이너만 종료할 때는 `-s` 없이:**  
  `docker kill <CONTAINER_ID>`

### "requires at least 1 argument"

- `docker kill -s 514619d0a061` 처럼 쓰면, Docker는 `514619d0a061`을 시그널 이름으로 받고, 컨테이너 ID는 비어 있다고 봅니다.
- **컨테이너만 종료:** `docker kill 514619d0a061`
- **시그널까지 지정:** `docker kill -s SIGTERM 514619d0a061`

### "cannot remove container ... is running"

- 먼저 중지: `docker stop <컨테이너>`  
- 또는 강제 삭제: `docker rm -f <컨테이너>`

### "port is already allocated" / "address already in use"

- 해당 포트를 쓰는 컨테이너를 찾아서 중지:  
  `docker ps` 후 `docker stop <컨테이너>`
- 또는 `docker-compose.yml`에서 해당 서비스의 호스트 포트를 다른 번호로 변경 (예: 3307 → 3308).

---

## Ansible / LLM 네트워크 질의 (인벤토리·SSH)

Docker에서 API 컨테이너는 **Ansible**을 사용해 LLM 네트워크 질의(예: `show` 명령)를 실행할 수 있습니다. 이를 위해 다음이 필요합니다.

### 인벤토리

- API 컨테이너는 `./ansible` 디렉터리를 `/app/ansible` 로 읽기 전용 마운트합니다.
- **인벤토리 파일**은 `ansible/inventory/hosts.ini` 에 두세요.  
  이 경로가 없으면 “Ansible 인벤토리가 없습니다” 오류가 납니다.
- `docker-compose.yml` 에 이미 `./ansible:/app/ansible:ro` 볼륨이 설정되어 있으므로, 호스트의 `./ansible` 아래에 playbook·inventory를 두면 컨테이너에서 사용됩니다.

### SSH 키 (선택)

- 네트워크 장비에 SSH로 접속하려면 컨테이너가 **SSH 키**를 읽을 수 있어야 합니다.
- 호스트의 SSH 키를 마운트하려면 `docker-compose.yml` 의 **api** 서비스 `volumes` 에 예를 들어 다음을 추가할 수 있습니다.  
  `- ~/.ssh:/app/.ssh:ro`  
  (또는 프로젝트 내 `./ansible/ssh` 등을 만들어 `./ansible/ssh:/app/.ssh:ro` 로 마운트)
- 키 권한은 호스트에서 `chmod 600` 등으로 맞춰 두세요.

### 요약

- **LLM 네트워크 질의(show 명령)** 를 쓰려면: `ansible/inventory/hosts.ini` 를 만들고, 필요 시 SSH 키를 볼륨으로 마운트하세요.
- 장비 메트릭 페이지는 별도로 더미 데이터를 사용할 수 있으며, 실제 수집값 연동은 별도 작업입니다.

---

이 매뉴얼은 프로젝트 내 **docs/DOCKER-MANUAL.md** 에 있으므로, 필요할 때마다 참고하면 됩니다.

# LLM(Ollama) 채팅 API 테스트

Ollama가 실행 중일 때 채팅 API를 확인하는 방법입니다.

---

## 1. Ollama만 먼저 확인 (선택)

API 서버 없이 Ollama가 응답하는지 확인합니다.

```bash
curl -s -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","prompt":"안녕","stream":false}' | head -c 500
```

**정상 응답 예시 (Ollama `/api/generate` 형식):**

```json
{
  "model": "llama3",
  "created_at": "2026-02-04T14:04:45.773077433Z",
  "response": "안녕하세요! 🙋‍♂️ How can I help you today? 😊",
  "done": true,
  "done_reason": "stop",
  "context": [128006, 882, ...],
  "total_duration": 6409646730,
  "load_duration": 3162015372,
  "prompt_eval_count": 12,
  "prompt_eval_duration": 498906551,
  "eval_count": 20,
  "eval_duration": 2729735487
}
```

- **response**: AI가 생성한 답변 문자열 (AION API는 이 값만 꺼내서 `response` 필드로 넘김).
- **done**: true 이면 한 번에 생성 완료 (stream:false 일 때).
- **total_duration** 등: 나노초 단위 시간. 참고용.
- `"response":"..."` 가 보이면 Ollama는 정상입니다.

---

## 2. AION API + 웹 서버 실행

```bash
cd /root/다운로드/first

# 터미널 1: API 서버 (Ollama는 이미 실행 중)
npm run start:api

# 터미널 2: 웹 서버 (브라우저로 테스트할 경우)
npm run start:web
```

- 웹: http://localhost:3000  
- API 직접: http://localhost:3001  

---

## 3. curl로 채팅 API 테스트

### 3-1. 로그인 (세션 쿠키 받기)

기본 관리자: **admin** / **admin123**

```bash
curl -c cookies.txt -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

`{"success":true,...}` 이면 성공입니다.

### 3-2. 채팅 요청 (쿠키로 인증)

```bash
curl -b cookies.txt -s -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"안녕하세요?"}'
```

- 성공: `{"success":true,"response":"(AI 답변)"}`
- Ollama 실패/타임아웃: `{"success":false,"error":"...","response":null}` + HTTP 503

API를 **3001** 로 직접 호출할 때는 `http://localhost:3000` 대신 `http://localhost:3001` 로 바꾸면 됩니다.

---

## 4. 브라우저로 테스트

1. http://localhost:3000 접속
2. 로그인 (admin / admin123)
3. **LLM 질의** 메뉴(또는 http://localhost:3000/llm-query) 이동
4. 메시지 입력 후 전송 → AI 응답과 에러 메시지 확인

---

## 5. Docker에서 API를 쓸 때

API가 Docker 컨테이너 안에서 돌면, 컨테이너 안의 `localhost`는 호스트가 아닙니다.

- Ollama를 **호스트**에서 실행 중이면 `.env` 에서:
  - `OLLAMA_URL=http://host.docker.internal:11434` (해당 기능 지원 시)
  - 또는 `OLLAMA_URL=http://호스트IP:11434` (예: `http://192.168.1.10:11434`)

이후 위 3번 curl에서 `http://localhost:3000` 대신 **웹/프록시에 접속하는 주소**를 사용하면 됩니다.

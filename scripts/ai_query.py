#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AION AI 질의응답 - ollama 라이브러리 사용. 로그=stderr, 결과=stdout JSON.
"""
import os
import sys
import json
import time
import ollama


def log_debug(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print("[{}] {}".format(ts, msg), file=sys.stderr, flush=True)


def main():
    message = (sys.argv[1] or "").strip() if len(sys.argv) > 1 else (sys.stdin.read() or "").strip()
    if not message:
        message = "Hello"
    reachable_hosts = []
    if len(sys.argv) > 2:
        try:
            reachable_hosts = json.loads(sys.argv[2])
        except Exception:
            pass

    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3")

    log_debug("AI 질의 시작 (Python, ollama 라이브러리)")
    log_debug("OLLAMA_MODEL={}".format(ollama_model))
    log_debug("질문: {}".format(message[:80] + ("..." if len(message) > 80 else "")))
    if reachable_hosts:
        log_debug("통신 가능 장비: {}".format(", ".join(reachable_hosts)))

    try:
        log_debug("Ollama chat 요청 중...")
        start = time.time()
        resp = ollama.chat(model=ollama_model, messages=[{"role": "user", "content": message}])
        elapsed = time.time() - start
        log_debug("Ollama 응답 수신 ({:.2f}초)".format(elapsed))

        response_text = (resp.get("message") or {}).get("content") or ""
        response_text = response_text.strip()
        log_debug("응답 길이: {} 글자".format(len(response_text)))

        result = {"success": True, "response": response_text}
        print(json.dumps(result, ensure_ascii=False), flush=True)
    except Exception as e:
        err_msg = str(e)
        log_debug("오류: {}".format(err_msg))
        result = {"success": False, "error": err_msg, "response": None}
        print(json.dumps(result, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

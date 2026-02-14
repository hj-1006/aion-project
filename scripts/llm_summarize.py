#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
장비 출력 → 한국어 요약. ollama 라이브러리 사용. stdout=요약 텍스트, stderr=로그.
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
    if len(sys.argv) < 2:
        print("", flush=True)
        return

    try:
        payload = json.loads(sys.argv[1])
    except Exception:
        print("", flush=True)
        return

    question = payload.get("question") or ""
    command = payload.get("command") or ""
    output_text = (payload.get("outputText") or "").strip()[:2000]

    if not output_text or "no hosts matched" in output_text or "skipping" in output_text or "PLAY RECAP" in output_text:
        log_debug("실제 장비 출력이 아니어서 요약 생략 (Ansible recap)")
        print("", flush=True)
        return

    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3")

    log_debug("LLM summarize 시작 (Python, ollama 라이브러리)")

    prompt = "네트워크 장비 조회 결과를 요약해주세요. 2~3문장으로 한국어로 답변.\n질문: {}\n실행 명령: {}\n\n출력:\n{}\n\n요약:".format(
        question, command, output_text
    )

    try:
        log_debug("Ollama chat 요청 중 (summarize)...")
        resp = ollama.chat(model=ollama_model, messages=[{"role": "user", "content": prompt}])
        summary = (resp.get("message") or {}).get("content") or ""
        summary = summary.strip()
        log_debug("Ollama 응답 수신")
        print(summary, flush=True)
    except Exception as e:
        log_debug("오류: {}".format(str(e)))
        print(output_text[:500] if output_text else "", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

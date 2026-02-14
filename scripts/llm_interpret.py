#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
질문 → hostname, command, action 해석. ollama 라이브러리 사용. stdout=JSON, stderr=로그.
"""
import os
import sys
import json
import re
import time
import ollama

COMMAND_HINTS = [
    "show ip interface brief", "show ip int brief", "show interfaces", "show ip route",
    "show vlan", "show running-config", "show version", "show ip protocols",
    "show cdp neighbors", "show arp"
]


def log_debug(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print("[{}] {}".format(ts, msg), file=sys.stderr, flush=True)


def extract_first_json_object(text):
    """첫 번째 '{' 부터 괄호 균형이 맞는 구간만 추출해 JSON 파싱 시도."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def parse_llm_json(text):
    """LLM 응답에서 JSON 객체 파싱. 흔한 오류(쉼표 누락) 보정 후 시도."""
    raw = extract_first_json_object(text)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # "value"\n  "key" -> "value",\n  "key" (쉼표 누락 보정)
    fixed = re.sub(r'"\s*\n\s*"', '",\n  "', raw)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        return None


def main():
    if len(sys.argv) < 2:
        out = {"hostname": "Router2", "command": "show ip interface brief", "error": "질문이 없습니다."}
        print(json.dumps(out, ensure_ascii=False), flush=True)
        sys.exit(1)

    question = (sys.argv[1] or "").strip()
    available_hosts = []
    if len(sys.argv) > 2:
        try:
            available_hosts = json.loads(sys.argv[2])
        except Exception:
            pass
    hosts = ", ".join(available_hosts) if available_hosts else "Router2, Router3"
    default_host = available_hosts[0] if available_hosts else "Router2"

    # 장비명(device_id) → IP 목록 매핑 (시드/DB와 동일한 정보로 LLM이 장비명-IP 매칭)
    device_ip_map = {}
    if len(sys.argv) > 3:
        try:
            device_ip_map = json.loads(sys.argv[3]) or {}
        except Exception:
            pass
    device_ip_lines = []
    for dev, ips in sorted(device_ip_map.items()):
        if ips:
            device_ip_lines.append("{}: {}".format(dev, ", ".join(ips)))
    device_ip_block = "\nDevice name to IP mapping (장비명 - IP, use hostname from this list):\n" + "\n".join(device_ip_lines) if device_ip_lines else ""

    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3")

    log_debug("LLM interpret 시작 (Python, ollama 라이브러리)")
    log_debug("질문: {}".format(question[:80] + ("..." if len(question) > 80 else "")))

    prompt = """You are a network automation assistant. The user will ask about network device info in Korean or English.

Available devices (hostnames): {}
{}
Allowed Cisco IOS show commands (reply with EXACT text): {}

User question: "{}"

Reply with ONLY a JSON object, no other text. Choose ONE format:
- For port/IP/VLAN/config/version etc: {{"hostname": "device_name", "command": "show ..."}}
- For CPU or memory usage: {{"hostname": "device_name", "action": "cpu_memory"}}
- For temperature/environment: {{"hostname": "device_name", "action": "temperature"}}

Rules: Use ONLY a hostname from the device list above. Never use "Router2" or "Router3" unless they appear in that list. For "BB router" or "BB 라우터" use BB_R1 or BB_R2. If unsure, use the first device in the list: {{"hostname": "{}", "command": "show ip interface brief"}}""".format(
        hosts, device_ip_block, ", ".join(COMMAND_HINTS), question, default_host
    )

    try:
        log_debug("Ollama chat 요청 중 (interpret)...")
        resp = ollama.chat(model=ollama_model, messages=[{"role": "user", "content": prompt}])
        text = (resp.get("message") or {}).get("content") or ""
        text = text.strip()
        log_debug("Ollama 응답 수신")

        parsed = parse_llm_json(text)
        if not parsed or not isinstance(parsed, dict):
            out = {"hostname": "Router2", "command": "show ip interface brief", "raw": (text[:500] if text else "")}
            print(json.dumps(out, ensure_ascii=False), flush=True)
            return

        hostname = (parsed.get("hostname") or "Router2").strip()
        action = (parsed.get("action") or "").strip().lower()
        command = (parsed.get("command") or "show ip interface brief").strip()

        out = {"hostname": hostname, "command": command, "raw": text[:500] if text else ""}
        if action in ("cpu_memory", "temperature"):
            out["action"] = action
        print(json.dumps(out, ensure_ascii=False), flush=True)
    except Exception as e:
        err_msg = str(e)
        log_debug("오류: {}".format(err_msg))
        out = {"hostname": "Router2", "command": "show ip interface brief", "error": err_msg}
        print(json.dumps(out, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

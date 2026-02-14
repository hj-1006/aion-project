#!/bin/bash
# 외부 PC에서 172.16.200.200(이 서버)으로 웹 접속하려면 80, 443 포트가 열려 있어야 합니다.
# 이 스크립트는 방화벽에서 해당 포트를 허용합니다. (root 또는 sudo 필요)
set -e
echo "[AION] 웹 접속용 포트(80, 443) 방화벽 허용 중..."

if command -v firewall-cmd &>/dev/null && [ "$(firewall-cmd --state 2>/dev/null)" = "running" ]; then
  sudo firewall-cmd --permanent --add-service=http 2>/dev/null || sudo firewall-cmd --permanent --add-port=80/tcp
  sudo firewall-cmd --permanent --add-service=https 2>/dev/null || sudo firewall-cmd --permanent --add-port=443/tcp
  sudo firewall-cmd --reload
  echo "[AION] firewalld: http(80), https(443) 허용 완료."
elif command -v ufw &>/dev/null && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw reload
  echo "[AION] ufw: 80, 443 허용 완료."
else
  echo "[AION] firewalld/ufw 없음 또는 비활성. 수동 확인:"
  echo "  - RHEL/CentOS/Rocky: sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload"
  echo "  - Ubuntu: sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw reload"
  echo "  - 방화벽이 꺼져 있으면 외부에서 172.16.200.200:80 으로 접속 가능해야 합니다."
fi

echo ""
echo "확인: 외부 PC에서 브라우저로 http://172.16.200.200 접속해 보세요."

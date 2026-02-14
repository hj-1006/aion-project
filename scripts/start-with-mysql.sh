#!/bin/bash
# MySQL 먼저 기동 후 PM2로 AION 서비스 시작.
# - Node 앱(aion-query, aion-api, aion-web)은 PM2가 죽으면 자동 재기동.
# - MySQL 자동 재기동: sudo systemctl enable mysqld (부팅 시 기동) 및 systemd 기본 정책.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Starting MySQL..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl start mysqld 2>/dev/null || sudo systemctl start mysql 2>/dev/null || true
  sleep 2
fi

cd "$PROJECT_ROOT"
echo "Starting PM2 (AION)..."
pm2 start ecosystem.config.js

echo "Done. Check: pm2 status"

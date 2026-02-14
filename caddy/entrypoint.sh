#!/bin/sh
# 인증서가 없으면 자동 발급 후 Caddy 기동 (docker compose up 만 해도 동작)
set -e
CERTS_DIR="${CADDY_CERTS_DIR:-/etc/caddy/certs}"
mkdir -p "$CERTS_DIR"
if [ ! -f "$CERTS_DIR/cert.pem" ]; then
  echo "인증서 없음 → 자동 발급: $CERTS_DIR/cert.pem, $CERTS_DIR/key.pem"
  SAN="DNS:aion.re.kr,DNS:aion.com,DNS:aion.org,DNS:www.aion.re.kr,DNS:www.aion.com,DNS:www.aion.org,DNS:localhost"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERTS_DIR/key.pem" \
    -out "$CERTS_DIR/cert.pem" \
    -subj "/CN=aion.com" \
    -addext "subjectAltName=$SAN"
  chmod 600 "$CERTS_DIR/key.pem"
  chmod 644 "$CERTS_DIR/cert.pem"
fi
exec caddy run --config /etc/caddy/Caddyfile

#!/bin/bash
# AION 전체 서비스 백업 (코드·설정·SQL·문서). node_modules 제외.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="aion-backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"

tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='*.log' \
    --exclude='tmp' \
    --exclude='.cursor' \
    -czvf "${BACKUP_DIR}/${ARCHIVE_NAME}" .

echo ""
echo "백업 완료: ${BACKUP_DIR}/${ARCHIVE_NAME}"
ls -la "${BACKUP_DIR}/${ARCHIVE_NAME}"

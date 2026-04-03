#!/bin/bash
# uxwVend Database Backup Script
# Usage: ./scripts/backup.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/uxwvend_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

# Extract DB connection from DATABASE_URL
if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set"
    exit 1
fi

echo "Creating backup..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

echo "Backup saved: ${BACKUP_FILE}.gz"
echo "Size: $(du -h "${BACKUP_FILE}.gz" | cut -f1)"

# Keep only last 10 backups
ls -t ${BACKUP_DIR}/uxwvend_*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null
echo "Done."

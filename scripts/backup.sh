#!/bin/bash
# uxwVend Database Backup Script
# Usage: ./scripts/backup.sh
#
# Connection parameters are parsed from DATABASE_URL and passed to pg_dump
# via named flags + PGPASSWORD env var. The previous form passed the full
# URL on the command line, which exposed the password in `ps aux` output.

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

# Parse DATABASE_URL (postgres://user:pass@host:port/db?…) into PG* env vars.
# `node -e` keeps URL decoding correct for special characters in the password.
eval "$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    const out = [];
    if (u.username) out.push("export PGUSER=" + JSON.stringify(decodeURIComponent(u.username)));
    if (u.password) out.push("export PGPASSWORD=" + JSON.stringify(decodeURIComponent(u.password)));
    if (u.hostname) out.push("export PGHOST=" + JSON.stringify(u.hostname));
    if (u.port) out.push("export PGPORT=" + JSON.stringify(u.port));
    const db = u.pathname.replace(/^\//, "");
    if (db) out.push("export PGDATABASE=" + JSON.stringify(db));
    console.log(out.join("\n"));
')"

if [ -z "$PGDATABASE" ]; then
    echo "Error: could not parse database name from DATABASE_URL"
    exit 1
fi

echo "Creating backup..."
# Password comes from PGPASSWORD env so it doesn't show in `ps aux`.
pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "$PGDATABASE" > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

echo "Backup saved: ${BACKUP_FILE}.gz"
echo "Size: $(du -h "${BACKUP_FILE}.gz" | cut -f1)"

# Keep only last 10 backups
ls -t ${BACKUP_DIR}/uxwvend_*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null
echo "Done."

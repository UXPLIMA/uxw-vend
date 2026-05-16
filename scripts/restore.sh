#!/bin/bash
# uxwVend Database Restore Script
# Usage: ./scripts/restore.sh backups/uxwvend_20260403.sql.gz
#
# Connection parameters are parsed from DATABASE_URL and passed to psql
# via named flags + PGPASSWORD env var (avoiding password exposure in
# `ps aux`).

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo "Available backups:"
    ls -la backups/uxwvend_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

if [ -f .env ]; then
    source <(grep -v '^#' .env | sed 's/^/export /')
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set"
    exit 1
fi

# Parse DATABASE_URL into PG* env vars — see backup.sh for the rationale.
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

echo "WARNING: This will overwrite the current database!"
read -p "Continue? (y/N) " confirm
if [ "$confirm" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo "Restoring from $1..."
gunzip -c "$1" | psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "$PGDATABASE"
echo "Restore complete."

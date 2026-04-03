#!/bin/bash
# uxwVend Database Restore Script
# Usage: ./scripts/restore.sh backups/uxwvend_20260403.sql.gz

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

echo "WARNING: This will overwrite the current database!"
read -p "Continue? (y/N) " confirm
if [ "$confirm" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo "Restoring from $1..."
gunzip -c "$1" | psql "$DATABASE_URL"
echo "Restore complete."

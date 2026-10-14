#!/bin/bash
# Script Backup Database CBT
# Bisa dijalankan kapan saja untuk mengambil backup dari VPS ke laptop lokal

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DIR/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$BACKUP_DIR/cbt_db_backup_$TIMESTAMP.sql.gz"

DB_HOST="173.234.14.237"
DB_PORT="5432"
DB_USER="cbt_user"
DB_NAME="cbt_db"
export PGPASSWORD="CbtYasda2026!#"

echo "==> Sedang membuat backup database dari $DB_HOST..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUTPUT_FILE"

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "✅ Backup berhasil dibuat:"
echo "   File : $OUTPUT_FILE"
echo "   Ukuran: $FILE_SIZE"

#!/bin/bash
# Script Restore Database CBT
# Penggunaan: bash scripts/restore-db.sh [path/to/backup.sql.gz]

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  # Cari file backup terbaru di folder backups
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  BACKUP_FILE=$(ls -t "$DIR/backups"/cbt_db_backup_*.sql.gz 2>/dev/null | head -n 1 || true)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ File backup tidak ditemukan!"
  echo "   Format: bash scripts/restore-db.sh backups/nama_file.sql.gz"
  exit 1
fi

echo "⚠️ PERINGATAN: Anda akan me-restore database dari file:"
echo "   $BACKUP_FILE"
read -p "Lanjutkan? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Dibatalkan."
  exit 0
fi

DB_HOST="173.234.14.237"
DB_PORT="5432"
DB_USER="cbt_user"
DB_NAME="cbt_db"
export PGPASSWORD="CbtYasda2026!#"

echo "==> Sedang me-restore database ke $DB_HOST..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
else
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

echo "✅ Restore database selesai dengan sukses!"

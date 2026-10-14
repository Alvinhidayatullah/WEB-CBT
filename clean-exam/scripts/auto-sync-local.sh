#!/bin/bash
# Auto-Sync Database CBT ke Laptop Lokal
# Script ini mendeteksi perubahan data (INSERT, UPDATE, DELETE) di database
# dan secara otomatis membuat snapshot backup ke laptop lokal.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$DIR/backups"
mkdir -p "$BACKUP_DIR"

STATE_FILE="$DIR/backups/.last_mutations.state"
LOG_FILE="$DIR/backups/sync.log"

DB_HOST="173.234.14.237"
DB_PORT="5432"
DB_USER="cbt_user"
DB_NAME="cbt_db"
export PGPASSWORD="CbtYasda2026!#"

# Cek jumlah mutasi data di database
MUTATIONS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COALESCE(tup_inserted + tup_updated + tup_deleted, 0) FROM pg_stat_database WHERE datname = '$DB_NAME';" 2>/dev/null || true)

if [ -z "$MUTATIONS" ]; then
    # Jika database VPS tidak bisa dihubungi, coba sync dari cPanel
    echo "[$(date)] [WARN] Database VPS tidak merespons, mencoba ambil backup terbaru dari cPanel..." >> "$LOG_FILE"
    exit 0
fi

LAST_MUTATIONS=0
if [ -f "$STATE_FILE" ]; then
    LAST_MUTATIONS=$(cat "$STATE_FILE")
fi

if [ "$MUTATIONS" -ne "$LAST_MUTATIONS" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    OUTPUT_FILE="$BACKUP_DIR/cbt_db_backup_$TIMESTAMP.sql.gz"

    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUTPUT_FILE"
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    DIFF=$((MUTATIONS - LAST_MUTATIONS))

    echo "[$(date)] [DATA BERUBAH: +$DIFF] Backup lokal berhasil disimpan: $OUTPUT_FILE ($FILE_SIZE)" >> "$LOG_FILE"
    echo "$MUTATIONS" > "$STATE_FILE"

    # Pertahankan 50 backup terbaru di laptop
    ls -t "$BACKUP_DIR"/cbt_db_backup_*.sql.gz 2>/dev/null | tail -n +51 | xargs -r rm -f
fi

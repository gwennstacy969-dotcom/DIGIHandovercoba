#!/usr/bin/env bash
# ==============================================================
# Pertamina HandoverApp - Emergency Disaster Recovery Restore Script
# Restores database and persistent media from backup snapshot
# Usage: ./restore.sh [BACKUP_DIRECTORY_PATH]
# Example: ./restore.sh /var/backups/handover/LATEST
# ==============================================================

set -euo pipefail

TARGET_BACKUP="${1:-/var/backups/handover/LATEST}"

if [ ! -d "${TARGET_BACKUP}" ]; then
    echo "ERROR: Backup directory not found at: ${TARGET_BACKUP}"
    exit 1
fi

echo "=========================================="
echo " EMERGENCY RESTORE FROM: ${TARGET_BACKUP}"
echo "=========================================="
read -p "Are you ABSOLUTELY SURE you want to restore? This will overwrite existing DB data! (type 'RESTORE-CONFIRM'): " CONFIRM

if [ "${CONFIRM}" != "RESTORE-CONFIRM" ]; then
    echo "Aborted."
    exit 1
fi

# 1. Restore Database
SQL_FILE=$(find "${TARGET_BACKUP}" -name "*.sql.gz" | head -n 1)
if [ -n "${SQL_FILE}" ]; then
    echo "[1/3] Restoring database from ${SQL_FILE}..."
    if docker ps --format '{{.Names}}' | grep -q "pertamina_handover_mysql"; then
        zcat "${SQL_FILE}" | docker exec -i pertamina_handover_mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" handover_pertamina
    else
        zcat "${SQL_FILE}" | mysql -u root handover_pertamina
    fi
    echo "  -> Database restored successfully."
fi

# 2. Restore Uploads
UPLOADS_FILE=$(find "${TARGET_BACKUP}" -name "uploads_*.tar.gz" | head -n 1)
if [ -n "${UPLOADS_FILE}" ]; then
    echo "[2/3] Restoring uploads from ${UPLOADS_FILE}..."
    tar -xzf "${UPLOADS_FILE}" -C "/var/www/handover-app/backend/"
    echo "  -> Uploads restored."
fi

# 3. Restore Barcodes
BARCODES_FILE=$(find "${TARGET_BACKUP}" -name "barcodes_*.tar.gz" | head -n 1)
if [ -n "${BARCODES_FILE}" ]; then
    echo "[3/3] Restoring barcodes from ${BARCODES_FILE}..."
    tar -xzf "${BARCODES_FILE}" -C "/var/www/handover-app/backend/"
    echo "  -> Barcodes restored."
fi

echo "=========================================="
echo " Restore completed successfully!"
echo "=========================================="

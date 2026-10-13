#!/usr/bin/env bash
# ==============================================================
# Pertamina HandoverApp - Automated Production Backup Script
# Creates compressed snapshots of MySQL Database, Uploads, and Barcodes
# ==============================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BASE_DIR="/var/backups/handover"
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
RETENTION_DAYS=14

echo "=========================================="
echo " Starting Pertamina Handover Backup: ${TIMESTAMP}"
echo "=========================================="

mkdir -p "${BACKUP_DIR}"

# 1. Backup MySQL Database
echo "[1/4] Backing up MySQL database..."
if docker ps --format '{{.Names}}' | grep -q "pertamina_handover_mysql"; then
    echo "  -> Dumping from Docker container pertamina_handover_mysql..."
    docker exec pertamina_handover_mysql mysqldump \
        --single-transaction \
        --quick \
        --routines \
        --triggers \
        -u root -p"${MYSQL_ROOT_PASSWORD}" handover_pertamina | gzip > "${BACKUP_DIR}/database_${TIMESTAMP}.sql.gz"
elif systemctl is-active --quiet mysql; then
    echo "  -> Dumping from host native MySQL service..."
    mysqldump \
        --single-transaction \
        --quick \
        --routines \
        --triggers \
        -u root handover_pertamina | gzip > "${BACKUP_DIR}/database_${TIMESTAMP}.sql.gz"
else
    echo "  [WARNING] No active MySQL service found to dump!"
fi

# 2. Backup Uploaded Photos (Evidence files)
echo "[2/4] Backing up uploaded photos..."
UPLOADS_SOURCE="/var/www/handover-app/backend/uploads"
if [ -d "${UPLOADS_SOURCE}" ]; then
    tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "/var/www/handover-app/backend" uploads
    echo "  -> Uploads archived successfully."
else
    echo "  [INFO] Uploads directory not found at ${UPLOADS_SOURCE}, skipping."
fi

# 3. Backup Barcodes
echo "[3/4] Backing up master barcodes..."
BARCODES_SOURCE="/var/www/handover-app/backend/barcodes"
if [ -d "${BARCODES_SOURCE}" ]; then
    tar -czf "${BACKUP_DIR}/barcodes_${TIMESTAMP}.tar.gz" -C "/var/www/handover-app/backend" barcodes
    echo "  -> Barcodes archived successfully."
fi

# Create a symlink to LATEST backup
ln -sfn "${BACKUP_DIR}" "${BACKUP_BASE_DIR}/LATEST"

# 4. Prune old backups older than RETENTION_DAYS
echo "[4/4] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_BASE_DIR}" -maxdepth 1 -mindepth 1 -type d ! -name "LATEST" -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +

echo "=========================================="
echo " Backup completed successfully: ${BACKUP_DIR}"
ls -lh "${BACKUP_DIR}"
echo "=========================================="

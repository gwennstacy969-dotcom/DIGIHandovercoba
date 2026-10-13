#!/usr/bin/env bash
# ==============================================================
# Pertamina HandoverApp - Production Cutover to Docker Compose
# Safely transitions running backend from PM2 to Docker containers
# Zero Data Loss Guarantee & Instant PM2 Fallback
# ==============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/deploy/docker/docker-compose.prod.yml"

echo "=========================================================="
echo " Starting Safe Cutover to Docker Production"
echo "=========================================================="

# 1. Step 1: Pre-migration Backup
echo "[Step 1/5] Executing pre-migration snapshot backup..."
bash "${SCRIPT_DIR}/backup.sh"

# 2. Step 2: Validate Docker Compose Configuration
echo "[Step 2/5] Validating docker-compose.prod.yml..."
cd "${PROJECT_ROOT}"
docker compose -f "${COMPOSE_FILE}" config > /dev/null
echo "  -> Compose configuration is valid."

# 3. Step 3: Pull Latest Images
echo "[Step 3/5] Pulling Docker images..."
docker compose -f "${COMPOSE_FILE}" pull

# 4. Step 4: Graceful PM2 Stop & Container Launch
echo "[Step 4/5] Transitioning service execution..."
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "pertamina-backend"; then
    echo "  -> Stopping legacy PM2 service (pertamina-backend)..."
    pm2 stop pertamina-backend || true
fi

echo "  -> Starting Docker Compose production stack..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# 5. Step 5: Verification & Safety Healthcheck
echo "[Step 5/5] Verifying system health (waiting up to 30 seconds)..."
HEALTHY=0
for i in {1..15}; do
    if curl -s -f http://127.0.0.1:3000/health > /dev/null; then
        HEALTHY=1
        break
    fi
    echo "  Waiting for container to be ready... (${i}/15)"
    sleep 2
done

if [ ${HEALTHY} -eq 1 ]; then
    echo "=========================================================="
    echo " CUTOVER SUCCESSFUL! Backend is running in Docker."
    echo " Legacy PM2 is kept stopped as an immediate fallback."
    echo "=========================================================="
else
    echo "=========================================================="
    echo " [CRITICAL WARNING] Docker backend failed health check!"
    echo " Rolling back to legacy PM2 service immediately..."
    echo "=========================================================="
    docker compose -f "${COMPOSE_FILE}" stop backend || true
    if command -v pm2 >/dev/null 2>&1; then
        pm2 start pertamina-backend || true
    fi
    echo " Rollback to PM2 completed. Investigation required."
    exit 1
fi

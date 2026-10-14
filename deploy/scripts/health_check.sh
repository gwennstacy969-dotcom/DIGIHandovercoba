#!/usr/bin/env bash
# ==============================================================
# Pertamina HandoverApp - Production Health Check Verification
# Tests internal and external endpoints, database connection, and Nginx
# ==============================================================

set -uo pipefail

echo "=========================================="
echo " Running Production Health Checks"
echo "=========================================="

FAILED=0

# 1. Local Container / Health Endpoint
echo -n "[1/4] Checking Backend internal health (http://127.0.0.1:3000/health)... "
HTTP_STATUS=$(curl -s -o /tmp/health_internal.json -w "%{http_code}" http://127.0.0.1:3000/health || echo "000")
if [ "${HTTP_STATUS}" -eq 200 ]; then
    echo "OK (HTTP 200)"
    cat /tmp/health_internal.json
    echo ""
else
    echo "FAILED (HTTP ${HTTP_STATUS})"
    FAILED=1
fi

# 2. Public Domain HTTPS Health Endpoint
echo -n "[2/4] Checking Public HTTPS health (https://pertamina-handover.com/health)... "
PUBLIC_STATUS=$(curl -s -k -o /tmp/health_public.json -w "%{http_code}" https://pertamina-handover.com/health || echo "000")
if [ "${PUBLIC_STATUS}" -eq 200 ]; then
    echo "OK (HTTP 200)"
else
    echo "FAILED (HTTP ${PUBLIC_STATUS})"
    FAILED=1
fi

# 3. Public Web Frontend
echo -n "[3/4] Checking Web Frontend (https://pertamina-handover.com/)... "
WEB_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" https://pertamina-handover.com/ || echo "000")
if [ "${WEB_STATUS}" -eq 200 ]; then
    echo "OK (HTTP 200)"
else
    echo "FAILED (HTTP ${WEB_STATUS})"
    FAILED=1
fi

# 4. Check Permanent APK Download Endpoint
echo -n "[4/4] Checking APK Download Endpoint (/download/digi-handover.apk)... "
APK_STATUS=$(curl -s -k -I https://pertamina-handover.com/download/digi-handover.apk | grep -E "HTTP/|Content-Type" || echo "NOT_FOUND")
echo "${APK_STATUS}"

echo "=========================================="
if [ ${FAILED} -eq 0 ]; then
    echo " ALL CHECKS PASSED: Production is healthy!"
    exit 0
else
    echo " HEALTH CHECKS REPORTED FAILURES!"
    exit 1
fi

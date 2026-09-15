#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Full Ecosystem Local Stack Launcher
# ==============================================================================
# Boots the entire post-quantum trust stack across all 3 tiers:
#   - Tier 1: Help Desk Client Portal       -> http://localhost:5000
#   - Tier 2: Operations Console & Backend   -> http://localhost:8080
#   - Tier 3: Verification Gateway API       -> http://localhost:3000
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
APP_DIR="$( cd "$DIR/../ScatterID-app" >/dev/null 2>&1 && pwd )"
cd "$DIR"

export JWT_SECRET="${JWT_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export VERIFICATION_API_KEY="${VERIFICATION_API_KEY:-scatterid-verification-key-2026-prod-alpha}"
export REVOKE_API_KEY="${REVOKE_API_KEY:-scatterid-revoke-key-2026-admin-immutable}"
export CRYPTO_SERVICE_API_KEY="${CRYPTO_SERVICE_API_KEY:-scatterid-crypto-key-2026-internal}"

mkdir -p components/verification-api/data components/ops-dashboard/data

echo "=============================================================="
echo "         ScatterID Post-Quantum Ecosystem Stack               "
echo "=============================================================="

# Stop previous instances if running
pkill -f "verification-api/src/server.js" || true
pkill -f "ops-dashboard/src/server.js" || true
pkill -f "client-portal/server" || true
pkill -f "vite" || true
sleep 1

# 1. Start Verification Gateway API (:3000)
echo "[+] [1/4] Starting Verification Gateway API (Port 3000)..."
(
  cd components/verification-api
  SQLITE_DB_PATH="data/credentials.db" PORT=3000 node src/server.js
) > "$DIR/components/verification-api/verification-api.log" 2>&1 &
VERIFY_PID=$!

# 2. Start Operations Console & Backend (:8080)
echo "[+] [2/4] Starting Operations Console & Moderation Engine (Port 8080)..."
(
  cd components/ops-dashboard
  SQLITE_DB_PATH="data/ops.db" VERIFICATION_API_URL="http://localhost:3000" PORT=8080 node src/server.js
) > "$DIR/components/ops-dashboard/ops-dashboard.log" 2>&1 &
OPS_PID=$!

# 3. Start Client Portal Proxy Backend (:5000)
echo "[+] [3/4] Starting Client Portal Proxy Forwarder (Port 5000)..."
(
  cd components/client-portal/server
  OPS_DASHBOARD_URL="http://localhost:8080" VERIFICATION_API_URL="http://localhost:3000" PORT=5000 npx tsx src/server.ts
) > "$DIR/components/client-portal/server/portal-server.log" 2>&1 &
PORTAL_SERVER_PID=$!

# 4. Start Client Portal Frontend (:5174)
echo "[+] [4/5] Starting Client Portal Frontend UI (Port 5174)..."
(
  cd components/client-portal/frontend
  npx vite --host 0.0.0.0 --port 5174
) > "$DIR/components/client-portal/frontend/portal-frontend.log" 2>&1 &
PORTAL_FRONTEND_PID=$!

# 5. Start Operations Console Web Dev Server (:5173)
echo "[+] [5/5] Starting Operations Console Vite UI (Port 5173)..."
(
  cd components/ops-dashboard-web
  npx vite --host 0.0.0.0 --port 5173
) > "$DIR/components/ops-dashboard-web/ops-web.log" 2>&1 &
OPS_WEB_PID=$!

# Wait for startup
sleep 3

# Verify Health
echo ""
echo "=== Service Diagnostic Probes ==="
curl -s http://localhost:3000/healthz >/dev/null && echo "  ✓ [Port 3000] Verification Gateway: http://localhost:3000/healthz  [HEALTHY]" || echo "  ✕ Verification Gateway failed"
curl -s http://localhost:8080/healthz >/dev/null && echo "  ✓ [Port 8080] Operations Console:   http://localhost:8080/healthz  [HEALTHY]" || echo "  ✕ Operations Console failed"
curl -s http://localhost:5000/healthz >/dev/null && echo "  ✓ [Port 5000] Client Portal Proxy:  http://localhost:5000/healthz  [HEALTHY]" || echo "  ✕ Client Portal Proxy failed"
curl -s http://localhost:5173/ >/dev/null && echo "  ✓ [Port 5173] Operations Console UI: http://localhost:5173/          [HEALTHY]" || echo "  ✕ Operations Console UI failed"
curl -s http://localhost:5174/ >/dev/null && echo "  ✓ [Port 5174] Client Portal UI:     http://localhost:5174/          [HEALTHY]" || echo "  ✕ Client Portal UI failed"

echo ""
echo "=============================================================="
echo "  ScatterID Ecosystem Live & Ready for Testing:               "
echo "  - Operations Console (Vite):        http://localhost:5173/  "
echo "  - Operations Console (Production):  http://localhost:8080/  "
echo "  - Client Help Desk Portal (Vite):   http://localhost:5174/  "
echo "  - Client Portal Proxy API:          http://localhost:5000/  "
echo "  - Verification Gateway API:         http://localhost:3000/  "
echo "=============================================================="
echo "  PIDs: Gateway=$VERIFY_PID, Ops=$OPS_PID, PortalProxy=$PORTAL_SERVER_PID, PortalUI=$PORTAL_FRONTEND_PID, OpsUI=$OPS_WEB_PID"

trap "kill $VERIFY_PID $OPS_PID $PORTAL_SERVER_PID $PORTAL_FRONTEND_PID $OPS_WEB_PID 2>/dev/null || true; exit 0" INT TERM
wait

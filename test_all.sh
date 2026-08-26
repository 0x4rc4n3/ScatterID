#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "======================================================="
echo "   ScatterID End-to-End Component Test Suite          "
echo "======================================================="

# Verify required keys are configured
if [ -z "$CRYPTO_SERVICE_API_KEY" ] || [ -z "$VERIFICATION_API_KEY" ] || [ -z "$GATEWAY_API_KEY" ]; then
    echo "ERROR: Environment keys are not set. Run ./quickstart.sh first to initialize .env"
    exit 1
fi

echo "[1/4] Checking running stack..."
docker compose up -d

# Give containers a moment to settle
sleep 2

# 2. Test Crypto Service (Port 5001)
echo ""
echo "[2/4] Testing Crypto Microservice (Flask / HTTPS:5001)..."

DATA_HASH="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

SIGN_RES=$(curl -s -k -X POST \
  -H "Authorization: Bearer $CRYPTO_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"dataHash\":\"$DATA_HASH\"}" \
  https://localhost:5001/sign_hash)

echo "  -> POST /sign_hash response:"
echo "     $SIGN_RES"

if echo "$SIGN_RES" | grep -q "ML-DSA-65"; then
    echo "  -> Crypto Service /sign_hash: PASSED"
else
    echo "  -> Crypto Service /sign_hash: FAILED"
    exit 1
fi

# 3. Test Verification API (Port 3000) - Full Issuance & Verification
echo ""
echo "[3/4] Testing Verification API (Express / HTTP:3000)..."

ID_KEY="idemp-key-$(date -u +%s%N)"

ISSUE_RES=$(curl -s -X POST \
  -H "Authorization: Bearer $VERIFICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"dataHash\":\"$DATA_HASH\", \"idempotencyKey\":\"$ID_KEY\"}" \
  http://localhost:3000/issue)

echo "  -> POST /issue response:"
echo "     $ISSUE_RES"

CRED_ID=$(echo "$ISSUE_RES" | grep -o '"credentialId":"[^"]*' | cut -d'"' -f4)

if [ -n "$CRED_ID" ]; then
    echo "  -> Issued Credential ID: $CRED_ID"
    
    VERIFY_RES=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"credentialId\":\"$CRED_ID\", \"dataHash\":\"$DATA_HASH\"}" \
      http://localhost:3000/verify)
      
    echo "  -> POST /verify response:"
    echo "     $VERIFY_RES"

    if echo "$VERIFY_RES" | grep -q '"valid":true'; then
        echo "  -> Verification API /verify: PASSED (Zero-Knowledge Hash Signature Validated)"
    else
        echo "  -> Verification API /verify: FAILED"
        exit 1
    fi
else
    echo "  -> Credential Issuance: FAILED"
    exit 1
fi

# 4. Test Project Control Dashboard (Port 4000)
echo ""
echo "[4/4] Testing Control Dashboard (Express / HTTP:4000)..."

DASHBOARD_STATUS=$(curl -s -H "Authorization: Bearer $GATEWAY_API_KEY" http://localhost:4000/api/status)
echo "  -> GET /api/status response:"
echo "     $DASHBOARD_STATUS"

if echo "$DASHBOARD_STATUS" | grep -q "services"; then
    echo "  -> Control Dashboard /api/status: PASSED"
else
    echo "  -> Control Dashboard /api/status: FAILED"
    exit 1
fi

echo ""
echo "======================================================="
echo "   All Component End-to-End Tests Complete!           "
echo "======================================================="

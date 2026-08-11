#!/usr/bin/env bash
# ==============================================================================
# ScatterID Phase 2 Fault-Tolerance Integration & Verification Suite
#
# Validates k-of-n Shamir Secret Sharing reconstruction thresholds by dynamically
# stopping, starting, and healing containerized storage nodes.
# ==============================================================================
set -euo pipefail

echo "======================================================================"
echo "   ScatterID Fault-Tolerance & Reconstruction Verification"
echo "======================================================================"

# Load environment configuration if available
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

VERIFICATION_API_URL="http://localhost:3000"

# Helper to compute HMAC secure headers
compute_secure_headers() {
  local body="$1"
  local apiKey="$2"
  python3 -c "
import time, random, hmac, hashlib, json

apiKey = '$apiKey'.encode()
timestamp = str(int(time.time()))
nonce = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=16))

body_data = '''$body'''
if body_data.strip():
    obj = json.loads(body_data)
    def canonicalize(val):
        if val is None: return 'null'
        if isinstance(val, bool): return 'true' if val else 'false'
        if isinstance(val, (int, float)): return str(val)
        if isinstance(val, str): return json.dumps(val)
        if isinstance(val, list): return '[' + ','.join(canonicalize(x) for x in val) + ']'
        keys = sorted(val.keys())
        return '{' + ','.join(f'\"{k}\":' + canonicalize(val[k]) for k in keys) + '}'
    body_str = canonicalize(obj)
else:
    body_str = ''

payload = f'{timestamp}.{nonce}.{body_str}'.encode()
sig = hmac.new(apiKey, payload, hashlib.sha256).hexdigest()
print(f'{sig} {timestamp} {nonce}')
"
}

# Helper: assert HTTP responses
assert_verification() {
  local expected_valid="$1"
  local description="$2"
  local apiKey="scatterid-test-api-key-999"
  
  local body="{\"credentialId\":\"$CRED_ID\"}"
  local sig ts nonce
  read -r sig ts nonce <<< $(compute_secure_headers "$body" "$apiKey")

  local response
  response=$(curl -s -X POST \
    -H "Authorization: Bearer $apiKey" \
    -H "X-Signature: $sig" \
    -H "X-Timestamp: $ts" \
    -H "X-Nonce: $nonce" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$VERIFICATION_API_URL/verify")
  
  local is_valid
  is_valid=$(echo "$response" | grep -o '"valid":[^,]*' | cut -d':' -f2 | tr -d ' }')
  
  if [ "$is_valid" = "$expected_valid" ]; then
    echo "  -> [PASS] $description (expected: $expected_valid, got: $is_valid)"
  else
    echo "  -> [FAIL] $description (expected: $expected_valid, got: $is_valid)"
    echo "     Response was: $response"
    exit 1
  fi
}

# 1. Issue new testing credential
echo "[Step 1] Issuing a new test credential..."
GATEWAY_API_KEY="scatterid-test-api-key-999"
ISSUE_BODY='{"claim":{"subject":"did:scatterid:fault-test","role":"Systems Audit Specialist"}}'

read -r SIG TS NONCE <<< $(compute_secure_headers "$ISSUE_BODY" "$GATEWAY_API_KEY")

ISSUE_RES=$(curl -s -X POST \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "X-Signature: $SIG" \
  -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -d "$ISSUE_BODY" \
  "$VERIFICATION_API_URL/issue")

CRED_ID=$(echo "$ISSUE_RES" | grep -o '"credentialId":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$CRED_ID" ]; then
  echo "CRITICAL: Could not issue test credential."
  echo "Response was: $ISSUE_RES"
  exit 1
fi

echo "  -> Credential Issued. ID: $CRED_ID"

# 2. Check nominal verification (5/5 nodes online)
echo "[Step 2] Testing nominal verification (5/5 nodes online)..."
assert_verification "true" "Nominal path verification"

# 3. Simulate failure by stopping 1 node (4/5 nodes online)
echo "[Step 3] Stopping 1 storage shard node (scatterid-shard-1)..."
docker stop scatterid-shard-1 >/dev/null
sleep 1
assert_verification "true" "1 node offline verification"

# 4. Simulate failure by stopping 2 nodes (3/5 nodes online)
echo "[Step 4] Stopping second storage shard node (scatterid-shard-2)..."
docker stop scatterid-shard-2 >/dev/null
sleep 1
assert_verification "true" "2 nodes offline verification (Minimum threshold met)"

# 5. Simulate failure by stopping 3 nodes (2/5 nodes online)
echo "[Step 5] Stopping third storage shard node (scatterid-shard-3)..."
docker stop scatterid-shard-3 >/dev/null
sleep 1
assert_verification "false" "3 nodes offline verification (Below minimum reconstruction threshold)"

# 6. Recover and restart stopped shard containers
echo "[Step 6] Recovering and restarting stopped shard containers..."
docker start scatterid-shard-1 scatterid-shard-2 scatterid-shard-3 >/dev/null
sleep 2

# 7. Run database healing on verification gateway API
echo "[Step 7] Triggering auto-healing state sync on recovered nodes..."
for node in 1 2 3; do
  HEAL_BODY="{\"nodeId\":$node}"
  read -r SIG TS NONCE <<< $(compute_secure_headers "$HEAL_BODY" "$GATEWAY_API_KEY")

  HEAL_RES=$(curl -s -X POST \
    -H "Authorization: Bearer $GATEWAY_API_KEY" \
    -H "X-Signature: $SIG" \
    -H "X-Timestamp: $TS" \
    -H "X-Nonce: $NONCE" \
    -H "Content-Type: application/json" \
    -d "$HEAL_BODY" \
    "$VERIFICATION_API_URL/heal-shards")
  echo "  -> Healed node-$node: $HEAL_RES"
done

# 8. Check final post-heal nominal verification
echo "[Step 8] Verifying recovered network conditions (5/5 nodes online)..."
assert_verification "true" "Post-heal recovery verification"

echo "======================================================================"
echo "   [SUCCESS] Phase 2 Fault-Tolerance Verification Complete!"
echo "======================================================================"

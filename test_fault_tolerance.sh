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
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

VERIFICATION_API_URL="http://localhost:3000"

# Helper: assert HTTP responses
assert_verification() {
  local expected_valid="$1"
  local description="$2"
  
  local response
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"credentialId\":\"$CRED_ID\"}" \
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
ISSUE_RES=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"claim":{"subject":"did:scatterid:fault-test","role":"Systems Audit Specialist"}}' \
  "$VERIFICATION_API_URL/issue")

CRED_ID=$(echo "$ISSUE_RES" | grep -o '"credentialId":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$CRED_ID" ]; then
  echo "CRITICAL: Could not issue test credential."
  echo "Response was: $ISSUE_RES"
  exit 1
fi
echo "  -> Issued Credential ID: $CRED_ID"

# 2. Check under nominal conditions (5/5 nodes online)
echo "[Step 2] Verifying under nominal conditions (5/5 nodes online)..."
assert_verification "true" "Nominal 5/5 status"

# 3. Simulate failure of 1 node (4/5 nodes online)
echo "[Step 3] Stopping Shard Node 1 (4/5 nodes online, k=3 threshold)..."
docker stop -t 1 scatterid-shard-1 >/dev/null
assert_verification "true" "1 node down"

# 4. Simulate failure of 2 nodes (3/5 nodes online)
echo "[Step 4] Stopping Shard Node 2 (3/5 nodes online, k=3 threshold)..."
docker stop -t 1 scatterid-shard-2 >/dev/null
assert_verification "true" "2 nodes down"

# 5. Simulate failure of 3 nodes (2/5 nodes online) - Should fail verification
echo "[Step 5] Stopping Shard Node 3 (2/5 nodes online, k=3 threshold)..."
docker stop -t 1 scatterid-shard-3 >/dev/null
assert_verification "false" "3 nodes down (below threshold)"

# 6. Restart all stopped shard node containers
echo "[Step 6] Recovering and restarting stopped shard containers..."
docker start scatterid-shard-1 scatterid-shard-2 scatterid-shard-3 >/dev/null
sleep 2

# 7. Run database healing on verification gateway API
echo "[Step 7] Triggering auto-healing state sync on recovered nodes..."
API_KEY="${SHARD_NODE_API_KEY:-dev-shard-key-456}"
for node in 1 2 3; do
  HEAL_RES=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"nodeId\":$node}" \
    "$VERIFICATION_API_URL/heal-shards")
  echo "  -> Healed node-$node: $HEAL_RES"
done

# 8. Check final post-heal nominal verification
echo "[Step 8] Verifying recovered network conditions (5/5 nodes online)..."
assert_verification "true" "Post-heal recovery verification"

echo "======================================================================"
echo "   [SUCCESS] Phase 2 Fault-Tolerance Verification Complete!"
echo "======================================================================"

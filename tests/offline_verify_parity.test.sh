#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Cross-Language Offline Verification Parity Test
# ==============================================================================
# Verifies that both Node.js (verify_offline.js) and Python (verify_offline.py)
# produce identical mathematical verification outcomes on valid and tampered
# test fixtures.
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$( cd "$DIR/.." >/dev/null 2>&1 && pwd )"
cd "$ROOT_DIR"

echo "=== Running Offline Verifier Cross-Language Parity Test ==="

# 1. Generate test fixture
FIXTURE_VALID='{
  "rawClaim": {
    "subject": "did:scatterid:user:alice-chen",
    "role": "Lead Cryptographic Architect",
    "org": "ScatterID Labs"
  },
  "salt": "00112233445566778899aabbccddeeff",
  "dataHash": "4e723ae7a1e05d21394ff0021c1f1ecb916fcdaeebc238b975971a8a29a43a08",
  "algorithm": "ML-DSA-65"
}'

# 2. Recompute expected hash with openssl / sha3-256 for ground truth
# Canonical JSON: {"org":"ScatterID Labs","role":"Lead Cryptographic Architect","subject":"did:scatterid:user:alice-chen"}
CANONICAL='{"org":"ScatterID Labs","role":"Lead Cryptographic Architect","subject":"did:scatterid:user:alice-chen"}'
GROUND_TRUTH_HASH=$( (echo -n -e '\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff'; echo -n "$CANONICAL") | openssl dgst -sha3-256 | awk '{print $NF}')

FIXTURE_VALID_ACCURATE=$(echo "$FIXTURE_VALID" | sed "s/4e723ae7a1e05d21394ff0021c1f1ecb916fcdaeebc238b975971a8a29a43a08/$GROUND_TRUTH_HASH/")

TMP_VALID=$(mktemp)
TMP_TAMPERED=$(mktemp)

echo "$FIXTURE_VALID_ACCURATE" > "$TMP_VALID"
echo "$FIXTURE_VALID_ACCURATE" | sed 's/Lead Cryptographic Architect/Tampered Impostor/' > "$TMP_TAMPERED"

# 3. Test Node.js Verifier on Valid Fixture
echo -n "[+] Testing Node.js verifier on valid fixture... "
node tools/verify_offline.js "$TMP_VALID" >/dev/null
echo "✓ Passed (Valid)"

# 4. Test Python Verifier on Valid Fixture
echo -n "[+] Testing Python verifier on valid fixture... "
python3 tools/verify_offline.py "$TMP_VALID" >/dev/null
echo "✓ Passed (Valid)"

# 5. Test Node.js Verifier on Tampered Fixture (must exit with error)
echo -n "[+] Testing Node.js verifier on tampered fixture... "
set +e
node tools/verify_offline.js "$TMP_TAMPERED" >/dev/null 2>&1
NODE_RES=$?
set -e
if [ $NODE_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ Failed to reject tampered data!"
  exit 1
fi

# 6. Test Python Verifier on Tampered Fixture (must exit with error)
echo -n "[+] Testing Python verifier on tampered fixture... "
set +e
python3 tools/verify_offline.py "$TMP_TAMPERED" >/dev/null 2>&1
PY_RES=$?
set -e
if [ $PY_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ Failed to reject tampered data!"
  exit 1
fi

rm -f "$TMP_VALID" "$TMP_TAMPERED"
echo "=== Offline Verifier Parity Test: ALL TESTS PASSED ==="

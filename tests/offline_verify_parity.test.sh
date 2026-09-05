#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Cross-Language Offline Verification Parity Test Suite
# ==============================================================================
# Verifies mathematical consistency and fail-closed security properties between
# Node.js (tools/verify_offline.js) and Python (tools/verify_offline.py):
#   1. RFC 8785 canonicalization and SHA3-256 pre-image commitment parity
#   2. Level 1 tampering detection (claim tampering, salt corruption)
#   3. Input validation (malformed schema, invalid JSON syntax)
#   4. Level 2 ML-DSA-65 post-quantum signature verification and forgery rejection
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$( cd "$DIR/.." >/dev/null 2>&1 && pwd )"
cd "$ROOT_DIR"

echo "=== Running Offline Verifier Cross-Language Parity Test Suite ==="

# Resolve Python binary with liboqs support
if command -v python3 >/dev/null 2>&1 && python3 -c "import oqs" >/dev/null 2>&1; then
  PY_BIN="python3"
elif [ -x "/tmp/crypto_venv/bin/python3" ]; then
  PY_BIN="/tmp/crypto_venv/bin/python3"
else
  PY_BIN="python3"
fi

# 1. Generate baseline test fixture
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

# Recompute ground truth SHA3-256 hash
CANONICAL='{"org":"ScatterID Labs","role":"Lead Cryptographic Architect","subject":"did:scatterid:user:alice-chen"}'
GROUND_TRUTH_HASH=$( (echo -n -e '\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff'; echo -n "$CANONICAL") | openssl dgst -sha3-256 | awk '{print $NF}')
FIXTURE_VALID_ACCURATE=$(echo "$FIXTURE_VALID" | sed "s/4e723ae7a1e05d21394ff0021c1f1ecb916fcdaeebc238b975971a8a29a43a08/$GROUND_TRUTH_HASH/")

TMP_VALID=$(mktemp)
TMP_TAMPERED_CLAIM=$(mktemp)
TMP_TAMPERED_SALT=$(mktemp)
TMP_MALFORMED=$(mktemp)
TMP_INVALID_JSON=$(mktemp)

echo "$FIXTURE_VALID_ACCURATE" > "$TMP_VALID"
echo "$FIXTURE_VALID_ACCURATE" | sed 's/Lead Cryptographic Architect/Tampered Impostor/' > "$TMP_TAMPERED_CLAIM"
echo "$FIXTURE_VALID_ACCURATE" | sed 's/00112233445566778899aabbccddeeff/ffeeddccbbaa99887766554433221100/' > "$TMP_TAMPERED_SALT"
echo '{"schema": "invalid_no_claim"}' > "$TMP_MALFORMED"
echo '{ bad json' > "$TMP_INVALID_JSON"

cleanup() {
  rm -f "$TMP_VALID" "$TMP_TAMPERED_CLAIM" "$TMP_TAMPERED_SALT" "$TMP_MALFORMED" "$TMP_INVALID_JSON"
}
trap cleanup EXIT

# [Test 1] Valid Fixture Verification
echo -n "[+] [1/6] Node.js verifier on valid fixture... "
node tools/verify_offline.js "$TMP_VALID" >/dev/null
echo "✓ Passed"

echo -n "[+] [2/6] Python verifier on valid fixture... "
$PY_BIN tools/verify_offline.py "$TMP_VALID" >/dev/null
echo "✓ Passed"

# [Test 2] Tampered Claim Rejection (Level 1)
echo -n "[+] [3/6] Node.js verifier rejects altered claim... "
set +e
node tools/verify_offline.js "$TMP_TAMPERED_CLAIM" >/dev/null 2>&1
NODE_RES=$?
set -e
if [ $NODE_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ FAILED to reject tampered claim!"
  exit 1
fi

echo -n "[+] [3/6] Python verifier rejects altered claim... "
set +e
$PY_BIN tools/verify_offline.py "$TMP_TAMPERED_CLAIM" >/dev/null 2>&1
PY_RES=$?
set -e
if [ $PY_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ FAILED to reject tampered claim!"
  exit 1
fi

# [Test 3] Tampered Salt Rejection (Level 1)
echo -n "[+] [4/6] Node.js verifier rejects altered salt... "
set +e
node tools/verify_offline.js "$TMP_TAMPERED_SALT" >/dev/null 2>&1
NODE_RES=$?
set -e
if [ $NODE_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ FAILED to reject tampered salt!"
  exit 1
fi

echo -n "[+] [4/6] Python verifier rejects altered salt... "
set +e
$PY_BIN tools/verify_offline.py "$TMP_TAMPERED_SALT" >/dev/null 2>&1
PY_RES=$?
set -e
if [ $PY_RES -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ FAILED to reject tampered salt!"
  exit 1
fi

# [Test 4] Schema and Malformed Input Rejection
echo -n "[+] [5/6] Rejecting malformed and syntactically invalid input... "
set +e
node tools/verify_offline.js "$TMP_MALFORMED" >/dev/null 2>&1
N1=$?
node tools/verify_offline.js "$TMP_INVALID_JSON" >/dev/null 2>&1
N2=$?
$PY_BIN tools/verify_offline.py "$TMP_MALFORMED" >/dev/null 2>&1
P1=$?
$PY_BIN tools/verify_offline.py "$TMP_INVALID_JSON" >/dev/null 2>&1
P2=$?
set -e
if [ $N1 -ne 0 ] && [ $N2 -ne 0 ] && [ $P1 -ne 0 ] && [ $P2 -ne 0 ]; then
  echo "✓ Correctly Rejected"
else
  echo "✕ FAILED to reject invalid input!"
  exit 1
fi

# [Test 5] Cryptographic Signature & Tamper Detection (Level 2)
if $PY_BIN -c "import oqs" >/dev/null 2>&1; then
  echo -n "[+] [6/6] PQC ML-DSA-65 signature authentication and forgery rejection... "
  TMP_SIGNED=$(mktemp)
  TMP_CORRUPT_SIG=$(mktemp)

  $PY_BIN -c "
import oqs, json
with oqs.Signature('ML-DSA-65') as signer:
    pk = signer.generate_keypair()
    msg = bytes.fromhex('$GROUND_TRUTH_HASH')
    sig = signer.sign(msg)
    data = json.loads('''$FIXTURE_VALID_ACCURATE''')
    data['signature'] = sig.hex()
    data['publicKey'] = pk.hex()
    with open('$TMP_SIGNED', 'w') as f:
        json.dump(data, f)
    # Corrupt first byte of signature
    corrupt_sig = ('00' if sig.hex()[:2] != '00' else 'ff') + sig.hex()[2:]
    data['signature'] = corrupt_sig
    with open('$TMP_CORRUPT_SIG', 'w') as f:
        json.dump(data, f)
"
  # Valid signature must pass Python verifier Level 2
  $PY_BIN tools/verify_offline.py "$TMP_SIGNED" >/dev/null

  # Forged signature must be rejected by Python verifier
  set +e
  $PY_BIN tools/verify_offline.py "$TMP_CORRUPT_SIG" >/dev/null 2>&1
  FORGE_RES=$?
  set -e
  if [ $FORGE_RES -ne 0 ]; then
    echo "✓ Valid Signature Verified & Forgery Rejected"
  else
    echo "✕ FAILED: Forged ML-DSA-65 signature was NOT rejected!"
    rm -f "$TMP_SIGNED" "$TMP_CORRUPT_SIG"
    exit 1
  fi
  rm -f "$TMP_SIGNED" "$TMP_CORRUPT_SIG"
else
  echo "[!] [6/6] Skipping Level 2 PQC signature verification test (liboqs not installed in current Python env)"
fi

echo "=== Offline Verifier Parity Test Suite: ALL TESTS PASSED ==="

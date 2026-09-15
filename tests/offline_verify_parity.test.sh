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
#   5. Signature parity matrix: {Node.js, Python} × {genuine, garbage-correct-length, absent}
#      + Python × {liboqs available, liboqs missing} rows
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

HAS_LIBOQS=false
if $PY_BIN -c "import oqs" >/dev/null 2>&1; then
  HAS_LIBOQS=true
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

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

check_pass() { echo "✓ Passed"; PASS_COUNT=$((PASS_COUNT + 1)); }
check_fail() { echo "✕ FAILED: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
check_skip() { echo "[SKIP] $1"; SKIP_COUNT=$((SKIP_COUNT + 1)); }

# [Test 1] Valid Fixture Verification
echo -n "[+] [1/12] Node.js verifier on valid fixture (no signature)... "
node tools/verify_offline.js "$TMP_VALID" >/dev/null && check_pass || check_fail "Node.js rejected valid fixture"

echo -n "[+] [2/12] Python verifier on valid fixture (no signature)... "
$PY_BIN tools/verify_offline.py "$TMP_VALID" >/dev/null && check_pass || check_fail "Python rejected valid fixture"

# [Test 2] Tampered Claim Rejection (Level 1)
echo -n "[+] [3/12] Node.js verifier rejects altered claim... "
set +e
node tools/verify_offline.js "$TMP_TAMPERED_CLAIM" >/dev/null 2>&1
NODE_RES=$?
set -e
if [ $NODE_RES -ne 0 ]; then check_pass; else check_fail "Node.js failed to reject tampered claim"; fi

echo -n "[+] [3b/12] Python verifier rejects altered claim... "
set +e
$PY_BIN tools/verify_offline.py "$TMP_TAMPERED_CLAIM" >/dev/null 2>&1
PY_RES=$?
set -e
if [ $PY_RES -ne 0 ]; then check_pass; else check_fail "Python failed to reject tampered claim"; fi

# [Test 3] Tampered Salt Rejection (Level 1)
echo -n "[+] [4/12] Node.js verifier rejects altered salt... "
set +e
node tools/verify_offline.js "$TMP_TAMPERED_SALT" >/dev/null 2>&1
NODE_RES=$?
set -e
if [ $NODE_RES -ne 0 ]; then check_pass; else check_fail "Node.js failed to reject tampered salt"; fi

echo -n "[+] [4b/12] Python verifier rejects altered salt... "
set +e
$PY_BIN tools/verify_offline.py "$TMP_TAMPERED_SALT" >/dev/null 2>&1
PY_RES=$?
set -e
if [ $PY_RES -ne 0 ]; then check_pass; else check_fail "Python failed to reject tampered salt"; fi

# [Test 4] Schema and Malformed Input Rejection
echo -n "[+] [5/12] Rejecting malformed and syntactically invalid input... "
set +e
node tools/verify_offline.js "$TMP_MALFORMED" >/dev/null 2>&1;  N1=$?
node tools/verify_offline.js "$TMP_INVALID_JSON" >/dev/null 2>&1; N2=$?
$PY_BIN tools/verify_offline.py "$TMP_MALFORMED" >/dev/null 2>&1;  P1=$?
$PY_BIN tools/verify_offline.py "$TMP_INVALID_JSON" >/dev/null 2>&1; P2=$?
set -e
if [ $N1 -ne 0 ] && [ $N2 -ne 0 ] && [ $P1 -ne 0 ] && [ $P2 -ne 0 ]; then
  check_pass
else
  check_fail "Some invalid inputs were not rejected (N1=$N1 N2=$N2 P1=$P1 P2=$P2)"
fi

# ============================================================
# [Test 5-12] SIGNATURE PARITY MATRIX
# Matrix: {Node.js, Python} × {genuine-sig, garbage-correct-length, absent-sig}
# + Python × {liboqs-missing} row
#
# Expected outcomes:
#   genuine-sig + liboqs available  → exit 0  (cryptographically verified)
#   garbage-correct-length          → exit != 0  (must be rejected)
#   absent-sig                      → exit 0  (UNAUTHENTICATED banner, hash still passes)
#   liboqs missing + sig present    → exit 2  (DEPENDENCY_MISSING, not 0)
# ============================================================

if $HAS_LIBOQS; then
  echo ""
  echo "--- Signature Parity Matrix (liboqs available) ---"

  # Generate signed fixture
  TMP_SIGNED=$(mktemp)
  TMP_GARBAGE_SIG=$(mktemp)
  TMP_ABSENT_SIG=$(mktemp)

  $PY_BIN -c "
import oqs, json, sys
with oqs.Signature('ML-DSA-65') as signer:
    pk = signer.generate_keypair()
    msg = bytes.fromhex('$GROUND_TRUTH_HASH')
    sig = signer.sign(msg)
    data = json.loads('''$FIXTURE_VALID_ACCURATE''')
    data['signature'] = sig.hex()
    data['publicKey'] = pk.hex()
    # Write genuine-signed fixture
    with open('$TMP_SIGNED', 'w') as f:
        json.dump(data, f)
    # Garbage signature: correct ML-DSA-65 length (3309 bytes) but random bytes
    import os
    garbage_sig = os.urandom(3309).hex()
    data['signature'] = garbage_sig
    with open('$TMP_GARBAGE_SIG', 'w') as f:
        json.dump(data, f)
    # Absent signature: strip signature and publicKey fields
    data2 = json.loads('''$FIXTURE_VALID_ACCURATE''')
    with open('$TMP_ABSENT_SIG', 'w') as f:
        json.dump(data2, f)
"

  # --- Python rows ---
  echo -n "[+] [6/12] Python + genuine-signature → exit 0 (VERIFIED)... "
  set +e
  $PY_BIN tools/verify_offline.py "$TMP_SIGNED" >/dev/null 2>&1
  PY_GENUINE=$?
  set -e
  if [ $PY_GENUINE -eq 0 ]; then check_pass; else check_fail "Python rejected genuine signature (exit $PY_GENUINE)"; fi

  echo -n "[+] [7/12] Python + garbage-correct-length-sig → exit != 0 (REJECTED)... "
  set +e
  $PY_BIN tools/verify_offline.py "$TMP_GARBAGE_SIG" >/dev/null 2>&1
  PY_GARBAGE=$?
  set -e
  if [ $PY_GARBAGE -ne 0 ]; then check_pass; else check_fail "Python ACCEPTED garbage signature — fail-open!"; fi

  echo -n "[+] [8/12] Python + absent-signature → exit 0 (UNAUTHENTICATED)... "
  set +e
  $PY_BIN tools/verify_offline.py "$TMP_ABSENT_SIG" >/dev/null 2>&1
  PY_ABSENT=$?
  set -e
  if [ $PY_ABSENT -eq 0 ]; then check_pass; else check_fail "Python rejected no-sig fixture (exit $PY_ABSENT)"; fi

  # --- Node.js rows (structural checks only — no native liboqs) ---
  echo -n "[+] [9/12] Node.js + genuine-signature → exit 0 (UNAUTHENTICATED, hash match)... "
  set +e
  node tools/verify_offline.js "$TMP_SIGNED" >/dev/null 2>&1
  JS_GENUINE=$?
  set -e
  if [ $JS_GENUINE -eq 0 ]; then check_pass; else check_fail "Node.js rejected genuine-sig fixture (exit $JS_GENUINE)"; fi

  echo -n "[+] [10/12] Node.js + garbage-correct-length-sig → exit 0 (UNAUTHENTICATED — structural check only)... "
  set +e
  node tools/verify_offline.js "$TMP_GARBAGE_SIG" >/dev/null 2>&1
  JS_GARBAGE=$?
  set -e
  # Node.js cannot cryptographically reject garbage (no liboqs), but must NOT claim "CRYPTOGRAPHICALLY VALID"
  # It exits 0 with UNAUTHENTICATED banner — acceptable; Python is the authority for sig verification
  GARBAGE_OUTPUT=$(node tools/verify_offline.js "$TMP_GARBAGE_SIG" 2>&1)
  if echo "$GARBAGE_OUTPUT" | grep -q "CRYPTOGRAPHICALLY VALID"; then
    check_fail "Node.js printed 'CRYPTOGRAPHICALLY VALID' for garbage signature — must never claim this"
  else
    check_pass
  fi

  echo -n "[+] [11/12] Node.js + absent-signature → exit 0 (UNAUTHENTICATED)... "
  set +e
  node tools/verify_offline.js "$TMP_ABSENT_SIG" >/dev/null 2>&1
  JS_ABSENT=$?
  set -e
  if [ $JS_ABSENT -eq 0 ]; then check_pass; else check_fail "Node.js rejected no-sig fixture (exit $JS_ABSENT)"; fi

  rm -f "$TMP_SIGNED" "$TMP_GARBAGE_SIG" "$TMP_ABSENT_SIG"

else
  echo "[i] liboqs not available — skipping signature matrix tests 6-11"
  SKIP_COUNT=$((SKIP_COUNT + 6))
fi

# --- Python × liboqs-missing row ---
# Simulate missing liboqs by wrapping the tool with a patched import.
# We create a thin wrapper that shadows the oqs module.
echo -n "[+] [12/12] Python + liboqs-missing + sig present → exit 2 (DEPENDENCY_MISSING, NOT exit 0)... "
TMP_FAKE_OQS_DIR=$(mktemp -d)
TMP_SIG_FOR_MISSING=$(mktemp)

# Build a fake credential with syntactically valid but dummy sig/pk bytes
$PY_BIN -c "
import json, os
data = json.loads('''$FIXTURE_VALID_ACCURATE''')
data['signature'] = ('aa' * 3309)  # 3309 garbage bytes, correct length
data['publicKey'] = ('bb' * 1952)  # 1952 garbage bytes, correct length
with open('$TMP_SIG_FOR_MISSING', 'w') as f:
    json.dump(data, f)
"

# Create a fake oqs module that raises ImportError when imported
cat > "$TMP_FAKE_OQS_DIR/oqs.py" << 'FAKE_OQS'
raise ImportError("Simulated missing liboqs-python for parity test")
FAKE_OQS

set +e
PYTHONPATH="$TMP_FAKE_OQS_DIR" $PY_BIN tools/verify_offline.py "$TMP_SIG_FOR_MISSING" >/dev/null 2>&1
MISSING_EXIT=$?
set -e

if [ $MISSING_EXIT -eq 2 ]; then
  check_pass
elif [ $MISSING_EXIT -eq 0 ]; then
  check_fail "CRITICAL: Python exited 0 (success) when liboqs was missing and sig was present — fail-open!"
else
  check_fail "Python exited $MISSING_EXIT (expected 2 for DEPENDENCY_MISSING)"
fi

rm -rf "$TMP_FAKE_OQS_DIR" "$TMP_SIG_FOR_MISSING"

# Summary
echo ""
echo "======================================================================"
echo "Parity Test Matrix Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed, ${SKIP_COUNT} skipped"
if [ $FAIL_COUNT -ne 0 ]; then
  echo "✕ PARITY TEST SUITE: ${FAIL_COUNT} FAILURE(S)"
  exit 1
else
  echo "=== Offline Verifier Parity Test Suite: ALL TESTS PASSED ==="
fi

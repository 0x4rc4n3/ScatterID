#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Cross-Implementation Differential Verifier Test Suite
# ==============================================================================
# Executes differential testing (§7) between tools/verify_offline.js (Node.js)
# and tools/verify_offline.py (Python) across valid, tampered, and forged vectors.
#
# Asserts:
#   1. Identical accept/reject decisions for Level 1 pre-image commitments
#   2. Explicit differentiation on Level 2 post-quantum signature verification:
#      - Python mathematically enforces ML-DSA-65 signatures and fails forgeries (exit 1)
#      - Node.js unambiguously warns unauthenticated status when mathematical verification is omitted (exit 0)
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$( cd "$DIR/.." >/dev/null 2>&1 && pwd )"
cd "$ROOT_DIR"

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================================${RESET}"
echo -e "${BOLD}${CYAN}  ScatterID — Differential Offline Verifier Test Suite (Python vs Node) ${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"

TMP_DIR=$(mktemp -d /tmp/scatterid_differential_XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# 1. Generate test vectors using Python oqs generator
python3 -c "
import os, json, hashlib, oqs
from tools.verify_offline import canonicalize

out_dir = '$TMP_DIR'

with oqs.Signature('ML-DSA-65') as signer:
    pk = signer.generate_keypair()

    # Vector 1: Valid Authenticated Credential
    claim_1 = {
        'subject': 'did:scatterid:user:dr-elena-rostova-4421',
        'role': 'Director of Quantum Security',
        'organization': 'CERN Advanced Computing',
        'securityClearance': 'Cosmic Top Secret',
        'issuedAt': '2026-03-01T00:00:00Z'
    }
    salt_1 = os.urandom(16).hex()
    canonical_1 = canonicalize(claim_1)
    hash_1 = hashlib.sha3_256(bytes.fromhex(salt_1) + canonical_1.encode('utf-8')).hexdigest()
    sig_1 = signer.sign(bytes.fromhex(hash_1)).hex()

    v1 = {
        'credentialId': '00000000-0000-4000-8000-000000000001',
        'rawClaim': claim_1,
        'salt': salt_1,
        'dataHash': hash_1,
        'signature': sig_1,
        'publicKey': pk.hex(),
        'algorithm': 'ML-DSA-65'
    }
    with open(os.path.join(out_dir, 'v1_valid.json'), 'w') as f:
        json.dump(v1, f, indent=2)

    # Vector 2: Tampered Claim (Altered attribute)
    v2 = json.loads(json.dumps(v1))
    v2['rawClaim']['securityClearance'] = 'Public Guest'
    with open(os.path.join(out_dir, 'v2_tampered_claim.json'), 'w') as f:
        json.dump(v2, f, indent=2)

    # Vector 3: Corrupted Salt
    v3 = json.loads(json.dumps(v1))
    v3['salt'] = os.urandom(16).hex()
    with open(os.path.join(out_dir, 'v3_tampered_salt.json'), 'w') as f:
        json.dump(v3, f, indent=2)

    # Vector 4: Structurally Valid Container (3309B signature) but Forged Cryptographic Bytes
    # Generates a valid pre-image commitment, valid 3309B signature length, but random garbage signature
    v4 = json.loads(json.dumps(v1))
    forged_sig = os.urandom(3309).hex()
    v4['signature'] = forged_sig
    with open(os.path.join(out_dir, 'v4_forged_signature_valid_structure.json'), 'w') as f:
        json.dump(v4, f, indent=2)

    # Vector 5: Truncated Signature Container (3000 bytes instead of 3309)
    v5 = json.loads(json.dumps(v1))
    v5['signature'] = v1['signature'][:6000] # 3000 hex chars = 3000 bytes (malformed length)
    with open(os.path.join(out_dir, 'v5_truncated_sig.json'), 'w') as f:
        json.dump(v5, f, indent=2)

    # Vector 6: Incomplete bundle missing salt
    v6 = {'rawClaim': claim_1, 'dataHash': hash_1}
    with open(os.path.join(out_dir, 'v6_missing_salt.json'), 'w') as f:
        json.dump(v6, f, indent=2)
"

PASSED_COUNT=0
TOTAL_COUNT=6

assert_run() {
  local desc="$1"
  local file="$2"
  local expected_node_exit="$3"
  local expected_py_exit="$4"
  local node_grep="$5"
  local py_grep="$6"

  echo -n -e "[+] Testing Vector: ${desc}... "

  set +e
  NODE_OUT=$(node tools/verify_offline.js "$file" 2>&1)
  NODE_CODE=$?

  PY_OUT=$(python3 tools/verify_offline.py "$file" 2>&1)
  PY_CODE=$?
  set -e

  # Check Node exit code
  if [ "$NODE_CODE" -ne "$expected_node_exit" ]; then
    echo -e "${RED}FAILED${RESET} (Node exited $NODE_CODE, expected $expected_node_exit)"
    echo "$NODE_OUT"
    exit 1
  fi

  # Check Python exit code
  if [ "$PY_CODE" -ne "$expected_py_exit" ]; then
    echo -e "${RED}FAILED${RESET} (Python exited $PY_CODE, expected $expected_py_exit)"
    echo "$PY_OUT"
    exit 1
  fi

  # Check Node expected output substring
  if [ -n "$node_grep" ] && ! echo "$NODE_OUT" | grep -Fq -- "$node_grep"; then
    echo -e "${RED}FAILED${RESET} (Node output missing expected text: '$node_grep')"
    echo "$NODE_OUT"
    exit 1
  fi

  # Check Python expected output substring
  if [ -n "$py_grep" ] && ! echo "$PY_OUT" | grep -Fq -- "$py_grep"; then
    echo -e "${RED}FAILED${RESET} (Python output missing expected text: '$py_grep')"
    echo "$PY_OUT"
    exit 1
  fi

  echo -e "${GREEN}✓ Passed${RESET}"
  PASSED_COUNT=$((PASSED_COUNT + 1))
}

# 1. Authentic valid credential
assert_run "Authentic ML-DSA-65 Credential" \
  "$TMP_DIR/v1_valid.json" \
  0 0 \
  "PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED)" \
  "CRYPTOGRAPHICALLY VALID & AUTHENTIC"

# 2. Tampered Claim Data
assert_run "Tampered Claim Attributes" \
  "$TMP_DIR/v2_tampered_claim.json" \
  1 1 \
  "LEVEL 1 VERIFICATION FAILED: FORGERY OR TAMPERING DETECTED" \
  "LEVEL 1 VERIFICATION FAILED: FORGERY OR TAMPERING DETECTED"

# 3. Altered Salt
assert_run "Altered Salt" \
  "$TMP_DIR/v3_tampered_salt.json" \
  1 1 \
  "LEVEL 1 VERIFICATION FAILED" \
  "LEVEL 1 VERIFICATION FAILED"

# 4. Structurally Valid (3309B) but Cryptographically Forged Signature
# Explicit architectural boundary:
# - Node passes Level 1 but unambiguously marks UNAUTHENTICATED (exit 0)
# - Python enforces Level 2 ML-DSA-65 math and FAILS with exit code 1
assert_run "Structurally Valid Container with Forged Signature" \
  "$TMP_DIR/v4_forged_signature_valid_structure.json" \
  0 1 \
  "PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED)" \
  "SIGNATURE VERIFICATION FAILED"

# 5. Truncated Signature Container
assert_run "Truncated Signature Container (< 3309B)" \
  "$TMP_DIR/v5_truncated_sig.json" \
  0 1 \
  "differs from ML-DSA-65 standard" \
  "SIGNATURE VERIFICATION FAILED"

# 6. Missing Required Field (Salt)
assert_run "Incomplete Credential Bundle" \
  "$TMP_DIR/v6_missing_salt.json" \
  1 1 \
  "[ERROR] Incomplete credential object" \
  "[ERROR] Incomplete credential object"

echo -e "\n${BOLD}${GREEN}Differential Verifier Suite Passed: ${PASSED_COUNT}/${TOTAL_COUNT} vectors verified!${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"

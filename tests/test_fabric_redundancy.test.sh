#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Fabric Network Redundancy & Ledger Snapshot Test Suite (§2 Finding 6)
# ==============================================================================
# Validates 3-node Raft consenter configuration, multi-peer topology, and
# AES-256 encrypted snapshot backup and verification tooling.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

echo "======================================================================"
echo "ScatterID — Testing Fabric Network Redundancy & Ledger Snapshotting"
echo "======================================================================"

FAILED=0

# 1. Validate configtx.yaml 3-node Raft consenters
echo -n "Test 1: configtx.yaml 3-node Raft consenters... "
CONSENTER_COUNT=$(grep -c "Host: orderer.*\.scatterid\.com" "${REPO_ROOT}/components/blockchain/fabric-network/configtx.yaml" || true)
if [[ "$CONSENTER_COUNT" -eq 3 ]]; then
  echo -e "${GREEN}PASS (Found 3 consenters)${RESET}"
else
  echo -e "${RED}FAIL (Expected 3 consenters, found ${CONSENTER_COUNT})${RESET}"
  FAILED=$((FAILED + 1))
fi

# 2. Validate configtx.yaml redundant anchor peers (peer0 and peer1 for both orgs)
echo -n "Test 2: configtx.yaml secondary anchor peers (peer1.issuer & peer1.verifier)... "
if grep -q "peer1.issuer.scatterid.com" "${REPO_ROOT}/components/blockchain/fabric-network/configtx.yaml" && \
   grep -q "peer1.verifier.scatterid.com" "${REPO_ROOT}/components/blockchain/fabric-network/configtx.yaml"; then
  echo -e "${GREEN}PASS${RESET}"
else
  echo -e "${RED}FAIL (Missing secondary anchor peers in configtx.yaml)${RESET}"
  FAILED=$((FAILED + 1))
fi

# 3. Validate docker-compose.yaml services (3 orderers and 4 peers)
echo -n "Test 3: docker-compose.yaml redundant service topology... "
COMPOSE="${REPO_ROOT}/components/blockchain/fabric-network/docker-compose.yaml"
if grep -q "orderer2.scatterid.com:" "$COMPOSE" && \
   grep -q "orderer3.scatterid.com:" "$COMPOSE" && \
   grep -q "peer1.issuer.scatterid.com:" "$COMPOSE" && \
   grep -q "peer1.verifier.scatterid.com:" "$COMPOSE"; then
  echo -e "${GREEN}PASS${RESET}"
else
  echo -e "${RED}FAIL (Missing redundant orderers or peers in docker-compose.yaml)${RESET}"
  FAILED=$((FAILED + 1))
fi

# 4. Test snapshot_ledger.sh and verify_ledger_snapshot.sh end-to-end
TEST_WORK_DIR=$(mktemp -d /tmp/test_ledger_snap_XXXXXX)
MOCK_LEDGER="${TEST_WORK_DIR}/mock_ledger"
SNAP_OUT="${TEST_WORK_DIR}/snapshots"
mkdir -p "${MOCK_LEDGER}/ledgersData/chains/chains/mychannel"
mkdir -p "${MOCK_LEDGER}/ledgersData/stateLeveldb"
echo "ScatterID-Block-000001-Genesis" > "${MOCK_LEDGER}/ledgersData/chains/chains/mychannel/blockfile_000000"
echo "ScatterID-Block-000002-AnchorProof" >> "${MOCK_LEDGER}/ledgersData/chains/chains/mychannel/blockfile_000000"
echo "ScatterID-LevelDB-State" > "${MOCK_LEDGER}/ledgersData/stateLeveldb/MANIFEST-000001"

TEST_PASS="CorrectHorseBatteryStaple2026!EncKey"

echo -n "Test 4: snapshot_ledger.sh creates encrypted artifact and manifest... "
bash "${REPO_ROOT}/components/blockchain/scripts/snapshot_ledger.sh" \
  --target-dir "$MOCK_LEDGER" \
  --output-dir "$SNAP_OUT" \
  --passphrase "$TEST_PASS" \
  --label "test-ledger" >/dev/null

ENC_FILES=(${SNAP_OUT}/*.enc)
MANIFEST_FILES=(${SNAP_OUT}/*.manifest.json)

if [[ -f "${ENC_FILES[0]}" && -f "${MANIFEST_FILES[0]}" ]]; then
  echo -e "${GREEN}PASS${RESET}"
else
  echo -e "${RED}FAIL (Artifacts not created)${RESET}"
  FAILED=$((FAILED + 1))
fi

echo -n "Test 5: verify_ledger_snapshot.sh succeeds on genuine snapshot... "
if bash "${REPO_ROOT}/components/blockchain/scripts/verify_ledger_snapshot.sh" \
  --snapshot "${ENC_FILES[0]}" \
  --passphrase "$TEST_PASS" \
  --extract-test >/dev/null; then
  echo -e "${GREEN}PASS${RESET}"
else
  echo -e "${RED}FAIL (Verification failed on genuine snapshot)${RESET}"
  FAILED=$((FAILED + 1))
fi

echo -n "Test 6: verify_ledger_snapshot.sh detects 1-bit tamper in ciphertext... "
TAMPERED_ENC="${TEST_WORK_DIR}/tampered.enc"
cp "${ENC_FILES[0]}" "$TAMPERED_ENC"
# Flip one byte at offset 64
python3 -c "
with open('${TAMPERED_ENC}', 'r+b') as f:
    f.seek(64)
    b = f.read(1)
    f.seek(64)
    f.write(bytes([b[0] ^ 0x01]))
"
if bash "${REPO_ROOT}/components/blockchain/scripts/verify_ledger_snapshot.sh" \
  --snapshot "$TAMPERED_ENC" \
  --manifest "${MANIFEST_FILES[0]}" \
  --passphrase "$TEST_PASS" >/dev/null 2>&1; then
  echo -e "${RED}FAIL (Tampered snapshot unexpectedly passed verification!)${RESET}"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}PASS (Tamper detected and rejected)${RESET}"
fi

echo -n "Test 7: verify_ledger_snapshot.sh rejects incorrect passphrase... "
if bash "${REPO_ROOT}/components/blockchain/scripts/verify_ledger_snapshot.sh" \
  --snapshot "${ENC_FILES[0]}" \
  --passphrase "WrongPassphrase123!" >/dev/null 2>&1; then
  echo -e "${RED}FAIL (Decryption succeeded with wrong passphrase!)${RESET}"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}PASS (Rejected wrong passphrase)${RESET}"
fi

# Cleanup test directory
rm -rf "$TEST_WORK_DIR"

echo "======================================================================"
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}✓ All 7 Fabric Redundancy & Snapshot Tests Passed!${RESET}"
  exit 0
else
  echo -e "${RED}✕ ${FAILED} test(s) failed!${RESET}"
  exit 1
fi

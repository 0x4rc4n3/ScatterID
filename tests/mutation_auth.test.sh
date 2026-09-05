#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Authorization Mutation Testing Framework (§9)
# ==============================================================================
# Deliberately injects logic inversions, removed guard clauses, and bypassed
# checks into smart contract chaincode, verification gateway API, and crypto
# service authorization routines to prove that test suites detect and kill
# every single mutant.
#
# A mutant SURVIVING indicates fake or shallow test coverage.
# 100% of injected mutants MUST be killed.
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
echo -e "${BOLD}${CYAN}    ScatterID — Authorization Mutation Testing Harness (§9)           ${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"

TOTAL_MUTANTS=0
KILLED_MUTANTS=0
SURVIVED_MUTANTS=0

TMP_WORKSPACE=$(mktemp -d /tmp/scatterid_mutation_XXXXXX)
cleanup() {
  rm -rf "$TMP_WORKSPACE"
}
trap cleanup EXIT

test_mutant() {
  local target_component="$1"
  local mutant_id="$2"
  local description="$3"
  local test_cmd="$4"

  TOTAL_MUTANTS=$((TOTAL_MUTANTS + 1))
  echo -n -e "[+] [Mutant ${TOTAL_MUTANTS}] [${target_component}] ${mutant_id}: ${description}... "

  set +e
  eval "$test_cmd" >/dev/null 2>&1
  local res=$?
  set -e

  if [ $res -ne 0 ]; then
    echo -e "${GREEN}KILLED${RESET} (Tests successfully failed on mutated code)"
    KILLED_MUTANTS=$((KILLED_MUTANTS + 1))
  else
    echo -e "${BOLD}${RED}SURVIVED${RESET} (CRITICAL: Tests passed despite mutated code!)"
    SURVIVED_MUTANTS=$((SURVIVED_MUTANTS + 1))
  fi
}

# ==============================================================================
# TRACK A: Smart Contract Authorization Mutations (scatterproof.go)
# ==============================================================================
echo -e "\n${BOLD}>>> Testing Smart Contract Chaincode Authorization Mutants...${RESET}"

CHAINCODE_SRC="$ROOT_DIR/components/blockchain/chaincode/src"

run_chaincode_mutant() {
  local mut_id="$1"
  local desc="$2"
  local find_str="$3"
  local replace_str="$4"

  local mut_dir="$TMP_WORKSPACE/chaincode_$mut_id"
  mkdir -p "$mut_dir"
  cp -r "$CHAINCODE_SRC"/* "$mut_dir"/

  python3 -c "
with open('$mut_dir/scatterproof.go', 'r') as f:
    c = f.read()
if '$find_str' not in c:
    print('Pattern not found: $find_str')
    exit(2)
mut = c.replace('$find_str', '$replace_str', 1)
with open('$mut_dir/scatterproof.go', 'w') as f:
    f.write(mut)
"
  test_mutant "Chaincode" "$mut_id" "$desc" "(cd $mut_dir && go test ./...)"
}

run_chaincode_mutant "MUT-CC-1" "Invert Revoke MSP check (!= to ==)" \
  'if clientMSPID != "IssuerMSP" {' \
  'if clientMSPID == "IssuerMSP" {'

run_chaincode_mutant "MUT-CC-2" "Bypass Revoke MSP check entirely" \
  'if clientMSPID != "IssuerMSP" {' \
  'if false {'

run_chaincode_mutant "MUT-CC-3" "Invert Revoke Issuer match check (!= to ==)" \
  'if record.IssuerID != requestingIssuerID {' \
  'if record.IssuerID == requestingIssuerID {'

run_chaincode_mutant "MUT-CC-4" "Bypass Revoke Issuer match check entirely" \
  'if record.IssuerID != requestingIssuerID {' \
  'if false {'

run_chaincode_mutant "MUT-CC-5" "Invert Revoke Status check (allow revoking revoked)" \
  'if record.Status == "revoked" {' \
  'if record.Status != "revoked" {'

run_chaincode_mutant "MUT-CC-6" "Bypass Anchor Replay Protection" \
  'if exists {' \
  'if false {'

run_chaincode_mutant "MUT-CC-7" "Invert Anchor MSP check" \
  'if clientMSPID != "IssuerMSP" {' \
  'if clientMSPID == "IssuerMSP" {'

# ==============================================================================
# TRACK B: Verification Gateway API Authorization Mutations (server.js)
# ==============================================================================
echo -e "\n${BOLD}>>> Testing Verification API Gateway Authorization Mutants...${RESET}"

API_SRC="$ROOT_DIR/components/verification-api"

run_api_mutant() {
  local mut_id="$1"
  local desc="$2"
  local find_str="$3"
  local replace_str="$4"

  local mut_dir="$TMP_WORKSPACE/api_$mut_id"
  mkdir -p "$mut_dir"
  cp -r "$API_SRC"/* "$mut_dir"/
  # symlink node_modules for speed
  rm -rf "$mut_dir/node_modules"
  ln -s "$API_SRC/node_modules" "$mut_dir/node_modules"

  python3 -c "
with open('$mut_dir/src/server.js', 'r') as f:
    c = f.read()
if '''$find_str''' not in c:
    print('Pattern not found in server.js: $find_str')
    exit(2)
mut = c.replace('''$find_str''', '''$replace_str''', 1)
with open('$mut_dir/src/server.js', 'w') as f:
    f.write(mut)
"
  test_mutant "Verification-API" "$mut_id" "$desc" "(cd $mut_dir && npm test)"
}

run_api_mutant "MUT-API-1" "Invert Bearer token hash comparison" \
  'if (!timingSafeEqual(tokenHash, keyHash)) {' \
  'if (timingSafeEqual(tokenHash, keyHash)) {'

run_api_mutant "MUT-API-2" "Bypass Bearer token authentication" \
  'if (!timingSafeEqual(tokenHash, keyHash)) {' \
  'if (false) {'

run_api_mutant "MUT-API-3" "Invert Revoke authorization hash comparison" \
  'if (!timingSafeEqual(candidateHash, expectedHash)) {' \
  'if (timingSafeEqual(candidateHash, expectedHash)) {'

run_api_mutant "MUT-API-4" "Bypass Revoke authorization key check" \
  'if (!timingSafeEqual(candidateHash, expectedHash)) {' \
  'if (false) {'

# ==============================================================================
# TRACK C: Crypto Microservice Authorization Mutations (app.py)
# ==============================================================================
echo -e "\n${BOLD}>>> Testing Crypto Microservice Authorization Mutants...${RESET}"

CRYPTO_SRC="$ROOT_DIR/components/crypto/crypto-service"

run_crypto_mutant() {
  local mut_id="$1"
  local desc="$2"
  local find_str="$3"
  local replace_str="$4"

  local mut_dir="$TMP_WORKSPACE/crypto_$mut_id"
  mkdir -p "$mut_dir"
  cp -r "$CRYPTO_SRC"/* "$mut_dir"/

  python3 -c "
with open('$mut_dir/app.py', 'r') as f:
    c = f.read()
if '''$find_str''' not in c:
    print('Pattern not found in app.py: $find_str')
    exit(2)
mut = c.replace('''$find_str''', '''$replace_str''', 1)
with open('$mut_dir/app.py', 'w') as f:
    f.write(mut)
"
  test_mutant "Crypto-Service" "$mut_id" "$desc" "python3 -m unittest discover $mut_dir"
}

run_crypto_mutant "MUT-CRYPTO-1" "Invert API key hmac.compare_digest check" \
  'if not hmac.compare_digest(token, API_KEY):' \
  'if hmac.compare_digest(token, API_KEY):'

run_crypto_mutant "MUT-CRYPTO-2" "Bypass API key check entirely" \
  'if not hmac.compare_digest(token, API_KEY):' \
  'if False:'

run_crypto_mutant "MUT-CRYPTO-3" "Bypass auth by widening /healthz condition" \
  'if request.path == "/healthz":' \
  'if True:'

# ==============================================================================
# Summary
# ==============================================================================
echo -e "\n${BOLD}${CYAN}======================================================================${RESET}"
echo -e "${BOLD}Mutation Testing Summary: ${KILLED_MUTANTS}/${TOTAL_MUTANTS} mutants killed.${RESET}"

if [ $SURVIVED_MUTANTS -eq 0 ]; then
  echo -e "${BOLD}${GREEN}100% MUTATION KILL RATE! ALL MUTANTS KILLED BY TEST SUITES!${RESET}"
  echo -e "${BOLD}${CYAN}======================================================================${RESET}"
  exit 0
else
  echo -e "${BOLD}${RED}CRITICAL FINDING: ${SURVIVED_MUTANTS} mutant(s) survived! Coverage is shallow.${RESET}"
  echo -e "${BOLD}${CYAN}======================================================================${RESET}"
  exit 1
fi

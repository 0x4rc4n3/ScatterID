#!/usr/bin/env bash
# ==============================================================================
# ScatterID — HashiCorp Vault AppRole Setup & Token Lifecycle Management
# ==============================================================================
# Automates the configuration of Vault AppRole authentication for the ML-DSA-65
# crypto-service, enforcing least-privilege policies and deprecating ambient
# root tokens in production.
#
# Usage:
#   ./scripts/security/setup_vault_approle.sh [OPTIONS]
#
# Options:
#   --setup              Configure AppRole, write policy, output role-id & secret-id (default)
#   --renew              Renew the active Vault client token
#   --rotate-secret-id   Generate a fresh secret-id for the crypto-service role
#   --vault-addr URL     Vault server address (default: $VAULT_ADDR or https://127.0.0.1:8200)
#   --role-name NAME     AppRole role name (default: crypto-service)
#   --policy-file PATH   Path to HCL policy file (default: components/crypto/vault/policies/crypto-service-policy.hcl)
#   --help               Display this help message
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}"
VAULT_ADMIN_TOKEN="${VAULT_TOKEN:-}"
ROLE_NAME="crypto-service"
POLICY_NAME="crypto-service"
POLICY_FILE="${REPO_ROOT}/components/crypto/vault/policies/crypto-service-policy.hcl"
ACTION="setup"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --setup)
      ACTION="setup"
      shift
      ;;
    --renew)
      ACTION="renew"
      shift
      ;;
    --rotate-secret-id)
      ACTION="rotate-secret-id"
      shift
      ;;
    --vault-addr)
      VAULT_ADDR="$2"
      shift 2
      ;;
    --role-name)
      ROLE_NAME="$2"
      shift 2
      ;;
    --policy-file)
      POLICY_FILE="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      exit 1
      ;;
  esac
done

check_curl() {
  if ! command -v curl &>/dev/null; then
    echo "[-] Error: curl is required but not installed." >&2
    exit 1
  fi
}

api_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local token="${4:-$VAULT_ADMIN_TOKEN}"

  local curl_args=(
    -s -S
    -X "$method"
    -H "X-Vault-Token: $token"
    -H "Content-Type: application/json"
  )

  if [[ -n "$data" ]]; then
    curl_args+=(-d "$data")
  fi

  curl "${curl_args[@]}" "${VAULT_ADDR}/v1/${path}"
}

do_setup() {
  echo "======================================================================"
  echo "ScatterID — Setting up Vault AppRole for '${ROLE_NAME}'"
  echo "Target Vault Address: ${VAULT_ADDR}"
  echo "======================================================================"

  if [[ -z "${VAULT_ADMIN_TOKEN}" ]]; then
    echo "[-] Error: VAULT_TOKEN must be set with administrative privileges to configure AppRole." >&2
    exit 1
  fi

  if [[ ! -f "${POLICY_FILE}" ]]; then
    echo "[-] Error: Policy file not found at: ${POLICY_FILE}" >&2
    exit 1
  fi

  echo "[+] 1. Ensuring AppRole auth engine is enabled..."
  api_request POST "sys/auth/approle" '{"type": "approle"}' >/dev/null 2>&1 || true

  echo "[+] 2. Applying least-privilege policy '${POLICY_NAME}'..."
  # Convert HCL content to JSON-escaped string
  python3 - <<PYEOF
import json, sys, subprocess

with open("${POLICY_FILE}", "r") as f:
    hcl_content = f.read()

payload = json.dumps({"policy": hcl_content})
cmd = [
    "curl", "-s", "-S", "-X", "PUT",
    "-H", f"X-Vault-Token: ${VAULT_ADMIN_TOKEN}",
    "-H", "Content-Type: application/json",
    "-d", payload,
    f"${VAULT_ADDR}/v1/sys/policies/acl/${POLICY_NAME}"
]
subprocess.run(cmd, check=True)
PYEOF

  echo "[+] 3. Configuring AppRole parameters (token_ttl=1h, max_ttl=24h, secret_id_ttl=720h)..."
  api_request POST "auth/approle/role/${ROLE_NAME}" '{
    "token_policies": "'"${POLICY_NAME}"'",
    "token_ttl": "1h",
    "token_max_ttl": "24h",
    "secret_id_ttl": "720h",
    "secret_id_num_uses": 0
  }' >/dev/null

  echo "[+] 4. Fetching AppRole Role ID..."
  ROLE_ID_RESP=$(api_request GET "auth/approle/role/${ROLE_NAME}/role-id")
  ROLE_ID=$(python3 -c "import sys, json; print(json.loads(sys.argv[1]).get('data', {}).get('role_id', ''))" "$ROLE_ID_RESP")

  if [[ -z "$ROLE_ID" ]]; then
    echo "[-] Error: Failed to retrieve Role ID. Response: ${ROLE_ID_RESP}" >&2
    exit 1
  fi

  echo "[+] 5. Generating initial AppRole Secret ID..."
  SECRET_ID_RESP=$(api_request POST "auth/approle/role/${ROLE_NAME}/secret-id" "{}")
  SECRET_ID=$(python3 -c "import sys, json; print(json.loads(sys.argv[1]).get('data', {}).get('secret_id', ''))" "$SECRET_ID_RESP")

  if [[ -z "$SECRET_ID" ]]; then
    echo "[-] Error: Failed to generate Secret ID. Response: ${SECRET_ID_RESP}" >&2
    exit 1
  fi

  echo ""
  echo "======================================================================"
  echo "✓ Vault AppRole configuration successful!"
  echo "======================================================================"
  echo "Add the following lines to your .env file for production:"
  echo ""
  echo "VAULT_ROLE_ID=${ROLE_ID}"
  echo "VAULT_SECRET_ID=${SECRET_ID}"
  echo "VAULT_DEV_MODE=false"
  echo ""
  echo "Note: Ambient root VAULT_TOKEN is deprecated and forbidden in production."
  echo "======================================================================"
}

do_rotate_secret_id() {
  if [[ -z "${VAULT_ADMIN_TOKEN}" ]]; then
    echo "[-] Error: VAULT_TOKEN required to rotate Secret ID." >&2
    exit 1
  fi

  echo "[+] Generating new Secret ID for role '${ROLE_NAME}'..."
  SECRET_ID_RESP=$(api_request POST "auth/approle/role/${ROLE_NAME}/secret-id" "{}")
  SECRET_ID=$(python3 -c "import sys, json; print(json.loads(sys.argv[1]).get('data', {}).get('secret_id', ''))" "$SECRET_ID_RESP")

  if [[ -z "$SECRET_ID" ]]; then
    echo "[-] Error: Failed to generate Secret ID. Response: ${SECRET_ID_RESP}" >&2
    exit 1
  fi

  echo "[+] New Secret ID generated successfully:"
  echo "VAULT_SECRET_ID=${SECRET_ID}"
}

do_renew() {
  local token="${VAULT_TOKEN:-}"
  if [[ -z "$token" ]]; then
    echo "[-] Error: VAULT_TOKEN must be specified to renew." >&2
    exit 1
  fi

  echo "[+] Renewing token lease at ${VAULT_ADDR}..."
  RENEW_RESP=$(api_request POST "auth/token/renew-self" '{"increment": "3600s"}' "$token")
  echo "[+] Renewal response: ${RENEW_RESP}"
}

check_curl

case "$ACTION" in
  setup)
    do_setup
    ;;
  rotate-secret-id)
    do_rotate_secret_id
    ;;
  renew)
    do_renew
    ;;
esac

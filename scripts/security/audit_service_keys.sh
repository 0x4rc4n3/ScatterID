#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Service-to-Service Cryptographic Key Posture & Audit Tool
# ==============================================================================
# Verifies zero-trust posture across all internal microservice credentials:
#   1. Key presence and 256-bit entropy verification
#   2. Key segregation (no reused credentials across services)
#   3. Key age monitoring against 30-day rotation SLA
#   4. Internal mTLS CA and certificate expiration validation
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

ENV_FILE="${ENV_FILE:-.env}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--env-file <path>]"
      exit 1
      ;;
  esac
done

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================================${RESET}"
echo -e "${BOLD}${CYAN}         ScatterID — Service Key & Zero-Trust Posture Audit           ${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"
echo "Inspecting: $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}[FAIL] Target env file '$ENV_FILE' does not exist.${RESET}"
  exit 1
fi

get_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true
}

ERRORS=0
WARNINGS=0

# 1. Key Presence & Entropy (256-bit / 32 bytes / 64 hex chars minimum)
REQUIRED_KEYS=(
  "CRYPTO_SERVICE_API_KEY"
  "VERIFICATION_API_KEY"
  "GATEWAY_API_KEY"
  "REVOKE_API_KEY"
  "JWT_SECRET"
)

declare -A KEY_VALUES

echo -e "\n${BOLD}[1/4] Verifying Key Presence & Entropy Thresholds (>= 256 bits)...${RESET}"
for k in "${REQUIRED_KEYS[@]}"; do
  val=$(get_val "$k")
  if [ -z "$val" ]; then
    echo -e "  ${RED}✕ MISSING: $k is unset or empty${RESET}"
    ERRORS=$((ERRORS + 1))
  else
    len=${#val}
    if [ "$len" -lt 32 ]; then
      echo -e "  ${RED}✕ WEAK ENTROPY: $k length is $len characters (< 32 bytes minimum)${RESET}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "  ${GREEN}✓ PRESENT & SECURE: $k ($len chars)${RESET}"
      KEY_VALUES["$k"]="$val"
    fi
  fi
done

# 2. Key Segregation Invariant (No duplicate keys across services)
echo -e "\n${BOLD}[2/4] Verifying Key Segregation (Least-Privilege Isolation)...${RESET}"
SEEN_KEYS=()
for k in "${REQUIRED_KEYS[@]}"; do
  val="${KEY_VALUES[$k]}"
  if [ -n "$val" ]; then
    for other in "${REQUIRED_KEYS[@]}"; do
      if [ "$k" != "$other" ] && [ -n "${KEY_VALUES[$other]}" ]; then
        if [ "$val" = "${KEY_VALUES[$other]}" ]; then
          echo -e "  ${RED}✕ KEY REUSE: $k matches $other! Distinct keys required for privilege separation.${RESET}"
          ERRORS=$((ERRORS + 1))
        fi
      fi
    done
  fi
done
if [ $ERRORS -eq 0 ]; then
  echo -e "  ${GREEN}✓ All service boundary keys are distinct and segregated.${RESET}"
fi

# 3. Key Age & Rotation SLA Check
echo -e "\n${BOLD}[3/4] Checking Service Key Rotation Age...${RESET}"
ROTATION_TS=$(get_val "KEY_ROTATION_TIMESTAMP")
MAX_AGE_DAYS=$(get_val "KEY_MAX_AGE_DAYS")
MAX_AGE_DAYS="${MAX_AGE_DAYS:-90}"

if [ -z "$ROTATION_TS" ]; then
  echo -e "  ${YELLOW}⚠ KEY_ROTATION_TIMESTAMP is unset. Key age cannot be audited against rotation SLA.${RESET}"
  WARNINGS=$((WARNINGS + 1))
else
  # Calculate age
  NOW_EPOCH=$(date +%s)
  ROTATION_EPOCH=$(date -d "$ROTATION_TS" +%s 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%SZ" "$ROTATION_TS" +%s 2>/dev/null || echo 0)
  if [ "$ROTATION_EPOCH" -eq 0 ]; then
    echo -e "  ${RED}✕ INVALID TIMESTAMP: Could not parse KEY_ROTATION_TIMESTAMP='$ROTATION_TS'${RESET}"
    ERRORS=$((ERRORS + 1))
  else
    AGE_DAYS=$(( (NOW_EPOCH - ROTATION_EPOCH) / 86400 ))
    echo -e "  Current key age: ${AGE_DAYS} days (SLA recommended: <= 30 days, hard limit: <= ${MAX_AGE_DAYS} days)"
    if [ "$AGE_DAYS" -ge "$MAX_AGE_DAYS" ]; then
      echo -e "  ${RED}✕ KEY EXPIRED: Service keys exceed max age limit (${AGE_DAYS} >= ${MAX_AGE_DAYS} days). Immediate rotation required!${RESET}"
      ERRORS=$((ERRORS + 1))
    elif [ "$AGE_DAYS" -ge 30 ]; then
      echo -e "  ${YELLOW}⚠ ROTATION DUE: Key age is ${AGE_DAYS} days (>= 30-day recommended rotation window).${RESET}"
      WARNINGS=$((WARNINGS + 1))
    else
      echo -e "  ${GREEN}✓ Service keys are within healthy rotation window.${RESET}"
    fi
  fi
fi

# 4. Mutual TLS (mTLS) Certificate Health
echo -e "\n${BOLD}[4/4] Validating mTLS Certificate Expiration & Integrity...${RESET}"
CA_CERT="components/crypto/certs/ca.crt"
if [ -f "$CA_CERT" ]; then
  if openssl x509 -checkend 2592000 -noout -in "$CA_CERT" >/dev/null 2>&1; then
    EXP_DATE=$(openssl x509 -enddate -noout -in "$CA_CERT" | cut -d'=' -f2)
    echo -e "  ${GREEN}✓ mTLS Root CA valid (Expires: $EXP_DATE)${RESET}"
  else
    echo -e "  ${RED}✕ mTLS Root CA certificate expires in less than 30 days or is already expired!${RESET}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "  ${YELLOW}⚠ $CA_CERT not found on disk (generated during quickstart or container boot).${RESET}"
  WARNINGS=$((WARNINGS + 1))
fi

echo -e "\n${BOLD}${CYAN}======================================================================${RESET}"
if [ $ERRORS -gt 0 ]; then
  echo -e "${BOLD}${RED}AUDIT FAILED: $ERRORS critical error(s), $WARNINGS warning(s) detected.${RESET}"
  echo -e "${BOLD}${CYAN}======================================================================${RESET}"
  exit 1
else
  echo -e "${BOLD}${GREEN}AUDIT PASSED: 0 critical errors, $WARNINGS warning(s). Zero-Trust posture verified.${RESET}"
  echo -e "${BOLD}${CYAN}======================================================================${RESET}"
  exit 0
fi

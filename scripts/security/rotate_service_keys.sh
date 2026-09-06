#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Zero-Downtime Service-to-Service Key Lifecycle Rotation Tool
# ==============================================================================
# Rotates static service keys across microservice boundaries with staged
# dual-key grace window support:
#   1. --stage     : Generates new primary keys; moves active keys to _PREVIOUS
#   2. --finalize  : Drops _PREVIOUS keys after service reboot/propagation
#   3. --status    : Inspects current key fingerprints and age
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

ENV_FILE="${ENV_FILE:-.env}"
MODE="stage"

while [[ $# -gt 0 ]]; do
  case $1 in
    --stage)
      MODE="stage"
      shift
      ;;
    --finalize)
      MODE="finalize"
      shift
      ;;
    --status)
      MODE="status"
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--stage | --finalize | --status] [--env-file <path>]"
      exit 1
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERROR] Environment file '$ENV_FILE' not found."
  exit 1
fi

get_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true
}

set_or_replace() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # In-place replace
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

remove_key() {
  local key="$1"
  sed -i "/^${key}=/d" "$ENV_FILE"
}

hash_fp() {
  local val="$1"
  if [ -n "$val" ]; then
    printf "%s" "$val" | sha256sum | awk '{print substr($1, 1, 16)}'
  else
    echo "none"
  fi
}

mkdir -p logs
AUDIT_LOG="logs/key_rotation_audit.log"

if [ "$MODE" = "status" ]; then
  echo "======================================================================"
  echo "         ScatterID Service-to-Service Key Lifecycle Status            "
  echo "======================================================================"
  echo "Target Env File: $ENV_FILE"
  ROTATION_TS=$(get_val "KEY_ROTATION_TIMESTAMP")
  echo "Last Rotation Timestamp : ${ROTATION_TS:-UNTRACKED}"

  echo ""
  echo "Current Key Fingerprints (SHA-256 / 16 chars):"
  for k in CRYPTO_SERVICE_API_KEY VERIFICATION_API_KEY GATEWAY_API_KEY REVOKE_API_KEY JWT_SECRET; do
    v=$(get_val "$k")
    prev=$(get_val "${k}_PREVIOUS")
    echo "  $k: $(hash_fp "$v") (Previous Grace: $(hash_fp "$prev"))"
  done
  exit 0
fi

NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$MODE" = "stage" ]; then
  echo "[+] Staging zero-downtime key rotation in $ENV_FILE..."

  # Move current to PREVIOUS
  for k in CRYPTO_SERVICE_API_KEY VERIFICATION_API_KEY GATEWAY_API_KEY REVOKE_API_KEY; do
    curr=$(get_val "$k")
    if [ -n "$curr" ]; then
      set_or_replace "${k}_PREVIOUS" "$curr"
    fi
    new_key=$(openssl rand -hex 32)
    set_or_replace "$k" "$new_key"
    echo "  [✓] Rotated $k (New FP: $(hash_fp "$new_key"), Grace FP: $(hash_fp "$curr"))"
  done

  # Also rotate JWT_SECRET if present
  curr_jwt=$(get_val "JWT_SECRET")
  if [ -n "$curr_jwt" ]; then
    new_jwt=$(openssl rand -hex 32)
    set_or_replace "JWT_SECRET" "$new_jwt"
    echo "  [✓] Rotated JWT_SECRET (New FP: $(hash_fp "$new_jwt"))"
  fi

  set_or_replace "KEY_ROTATION_TIMESTAMP" "$NOW_ISO"
  set_or_replace "KEY_MAX_AGE_DAYS" "30"

  chmod 600 "$ENV_FILE"
  echo "[${NOW_ISO}] [ROTATION_STAGE] Rotated service keys with active grace period into $ENV_FILE" >> "$AUDIT_LOG"
  echo "[+] Staged rotation complete. Services now accept both new keys and previous keys."
  echo "    Reboot microservices, then run: $0 --finalize"

elif [ "$MODE" = "finalize" ]; then
  echo "[+] Finalizing rotation: Purging previous grace keys from $ENV_FILE..."
  for k in CRYPTO_SERVICE_API_KEY VERIFICATION_API_KEY GATEWAY_API_KEY REVOKE_API_KEY; do
    remove_key "${k}_PREVIOUS"
    echo "  [✓] Purged ${k}_PREVIOUS"
  done
  chmod 600 "$ENV_FILE"
  echo "[${NOW_ISO}] [ROTATION_FINALIZE] Purged previous grace keys from $ENV_FILE" >> "$AUDIT_LOG"
  echo "[+] Key rotation finalized. Previous keys are now fully invalidated."
fi

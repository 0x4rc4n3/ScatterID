#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Fabric Ledger Snapshot Cryptographic Verification Tool
# ==============================================================================
# Verifies integrity and authenticity of AES-256 encrypted ledger snapshots,
# validates checksums against manifest, and tests decryptability without
# leaving unencrypted residue on disk.
#
# Usage:
#   ./components/blockchain/scripts/verify_ledger_snapshot.sh [OPTIONS]
#
# Options:
#   --snapshot PATH      Path to the .enc encrypted snapshot file
#   --manifest PATH      Path to .manifest.json (optional, defaults to adjacent manifest)
#   --passphrase SECRET  AES-256 decryption passphrase (or $LEDGER_BACKUP_PASSPHRASE)
#   --extract-test       Test full archive extraction into a temporary scratch space
#   --help               Display this help message
# ==============================================================================

set -euo pipefail

SNAPSHOT=""
MANIFEST=""
PASSPHRASE="${LEDGER_BACKUP_PASSPHRASE:-}"
EXTRACT_TEST=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot)
      SNAPSHOT="$2"
      shift 2
      ;;
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --passphrase)
      PASSPHRASE="$2"
      shift 2
      ;;
    --extract-test)
      EXTRACT_TEST=true
      shift
      ;;
    --help|-h)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SNAPSHOT" ]]; then
  echo "[-] Error: --snapshot must be specified." >&2
  exit 1
fi

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "[-] Error: Snapshot file not found: $SNAPSHOT" >&2
  exit 1
fi

if [[ -z "$MANIFEST" ]]; then
  DIRNAME=$(dirname "$SNAPSHOT")
  BASENAME=$(basename "$SNAPSHOT" .enc)
  AUTO_MANIFEST="${DIRNAME}/${BASENAME}.manifest.json"
  if [[ -f "$AUTO_MANIFEST" ]]; then
    MANIFEST="$AUTO_MANIFEST"
  else
    echo "[-] Error: Manifest not found and none auto-detected at $AUTO_MANIFEST" >&2
    exit 1
  fi
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "[-] Error: Manifest file not found: $MANIFEST" >&2
  exit 1
fi

if [[ -z "$PASSPHRASE" ]]; then
  echo "[-] Error: Passphrase must be provided via --passphrase or LEDGER_BACKUP_PASSPHRASE." >&2
  exit 1
fi

TMP_DIR=$(mktemp -d /tmp/ledger_verify_XXXXXX)
TMP_DEC="${TMP_DIR}/decrypted.tar.gz"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "======================================================================"
echo "ScatterID — Verifying Ledger Snapshot Integrity"
echo "  Target Snapshot: ${SNAPSHOT}"
echo "  Manifest: ${MANIFEST}"
echo "======================================================================"

echo "[+] 1. Verifying ciphertext checksum against manifest..."
ACTUAL_ENC_SHA256=$(sha256sum "$SNAPSHOT" | awk '{print $1}')
EXPECTED_ENC_SHA256=$(python3 -c "import json; print(json.load(open('${MANIFEST}'))['encrypted_sha256'])")

if [[ "$ACTUAL_ENC_SHA256" != "$EXPECTED_ENC_SHA256" ]]; then
  echo "[-] CRITICAL TAMPER DETECTED: Ciphertext SHA-256 does not match manifest!" >&2
  echo "    Expected: ${EXPECTED_ENC_SHA256}" >&2
  echo "    Actual:   ${ACTUAL_ENC_SHA256}" >&2
  exit 2
fi
echo "  ✓ Ciphertext checksum verified: ${ACTUAL_ENC_SHA256}"

echo "[+] 2. Decrypting archive using AES-256-CBC..."
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -salt -in "$SNAPSHOT" -out "$TMP_DEC" -pass "pass:${PASSPHRASE}" 2>/dev/null; then
  echo "[-] CRITICAL: Decryption failed. Incorrect passphrase or corrupt header/payload." >&2
  exit 3
fi
echo "  ✓ Decryption successful."

echo "[+] 3. Verifying plaintext SHA-256 digest against provenance manifest..."
ACTUAL_UNENC_SHA256=$(sha256sum "$TMP_DEC" | awk '{print $1}')
EXPECTED_UNENC_SHA256=$(python3 -c "import json; print(json.load(open('${MANIFEST}'))['unencrypted_sha256'])")

if [[ "$ACTUAL_UNENC_SHA256" != "$EXPECTED_UNENC_SHA256" ]]; then
  echo "[-] CRITICAL INTEGRITY FAILURE: Decrypted plaintext hash mismatch!" >&2
  echo "    Expected: ${EXPECTED_UNENC_SHA256}" >&2
  echo "    Actual:   ${ACTUAL_UNENC_SHA256}" >&2
  exit 4
fi
echo "  ✓ Plaintext digest verified: ${ACTUAL_UNENC_SHA256}"

echo "[+] 4. Verifying gzip / tar archive format integrity..."
if ! tar -tzf "$TMP_DEC" >/dev/null 2>&1; then
  echo "[-] CRITICAL: Decrypted file is not a valid tar.gz archive." >&2
  exit 5
fi
echo "  ✓ Archive catalog successfully parsed."

if [[ "$EXTRACT_TEST" == "true" ]]; then
  echo "[+] 5. Testing extraction in isolated sandbox..."
  EXTRACT_DIR="${TMP_DIR}/extracted"
  mkdir -p "$EXTRACT_DIR"
  tar -xzf "$TMP_DEC" -C "$EXTRACT_DIR"
  FILE_COUNT=$(find "$EXTRACT_DIR" -type f | wc -l)
  echo "  ✓ Extracted ${FILE_COUNT} files successfully."
fi

echo ""
echo "======================================================================"
echo "✓ PASS: Ledger snapshot cryptographic integrity verified successfully!"
echo "======================================================================"

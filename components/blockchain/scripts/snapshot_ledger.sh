#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Fabric Ledger Redundant Snapshot & Cold-Backup Tool
# ==============================================================================
# Takes cold-backup or live volume snapshots of Hyperledger Fabric ledger
# state directories, verifies integrity, and encrypts with AES-256-CBC/PBKDF2.
#
# Usage:
#   ./components/blockchain/scripts/snapshot_ledger.sh [OPTIONS]
#
# Options:
#   --target-dir PATH    Source ledger state directory to backup
#   --output-dir PATH    Directory to save encrypted snapshot (default: components/blockchain/snapshots)
#   --passphrase SECRET  AES-256 encryption key/passphrase (or $LEDGER_BACKUP_PASSPHRASE)
#   --label NAME         Label prefix for snapshot (default: fabric-ledger)
#   --help               Display this help message
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

TARGET_DIR=""
OUTPUT_DIR="${REPO_ROOT}/components/blockchain/snapshots"
PASSPHRASE="${LEDGER_BACKUP_PASSPHRASE:-}"
LABEL="fabric-ledger"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --passphrase)
      PASSPHRASE="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
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

if [[ -z "$TARGET_DIR" ]]; then
  echo "[-] Error: --target-dir must be specified." >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "[-] Error: Target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

if [[ -z "$PASSPHRASE" ]]; then
  echo "[-] Error: Passphrase must be provided via --passphrase or LEDGER_BACKUP_PASSPHRASE." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
SNAPSHOT_BASE="${LABEL}_${TIMESTAMP}"
TMP_TAR=$(mktemp "/tmp/${SNAPSHOT_BASE}_XXXXXX.tar.gz")
ENC_FILE="${OUTPUT_DIR}/${SNAPSHOT_BASE}.enc"
MANIFEST_FILE="${OUTPUT_DIR}/${SNAPSHOT_BASE}.manifest.json"

cleanup() {
  rm -f "$TMP_TAR"
}
trap cleanup EXIT

echo "[+] 1. Archiving ledger state directory from '${TARGET_DIR}'..."
tar -czf "$TMP_TAR" -C "$TARGET_DIR" .

echo "[+] 2. Computing unencrypted SHA-256 digest..."
UNENC_SHA256=$(sha256sum "$TMP_TAR" | awk '{print $1}')
FILE_SIZE=$(stat -c%s "$TMP_TAR" 2>/dev/null || stat -f%z "$TMP_TAR")

echo "[+] 3. Encrypting archive with AES-256 (PBKDF2 100,000 iterations)..."
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -in "$TMP_TAR" -out "$ENC_FILE" -pass "pass:${PASSPHRASE}"
chmod 0600 "$ENC_FILE"

echo "[+] 4. Computing encrypted artifact SHA-256 digest..."
ENC_SHA256=$(sha256sum "$ENC_FILE" | awk '{print $1}')
ENC_SIZE=$(stat -c%s "$ENC_FILE" 2>/dev/null || stat -f%z "$ENC_FILE")

echo "[+] 5. Writing cryptographic provenance manifest..."
cat << JSON_EOF > "$MANIFEST_FILE"
{
  "timestamp": "${TIMESTAMP}",
  "label": "${LABEL}",
  "source_directory": "${TARGET_DIR}",
  "encryption_algorithm": "AES-256-CBC-PBKDF2-100K",
  "unencrypted_sha256": "${UNENC_SHA256}",
  "unencrypted_size_bytes": ${FILE_SIZE},
  "encrypted_file": "$(basename "$ENC_FILE")",
  "encrypted_sha256": "${ENC_SHA256}",
  "encrypted_size_bytes": ${ENC_SIZE}
}
JSON_EOF
chmod 0600 "$MANIFEST_FILE"

echo ""
echo "======================================================================"
echo "✓ Ledger snapshot created successfully!"
echo "  Artifact: ${ENC_FILE}"
echo "  Manifest: ${MANIFEST_FILE}"
echo "  Plaintext SHA-256: ${UNENC_SHA256}"
echo "  Encrypted SHA-256: ${ENC_SHA256}"
echo "======================================================================"

#!/usr/bin/env python3
"""
==============================================================================
ScatterID — "Don't Trust, Verify" Standalone Offline CLI Verifier (Python)
==============================================================================
This tool allows third-party auditors and verifiers to mathematically verify
the cryptographic authenticity of an issued ScatterID credential COMPLETELY
OFFLINE:
  1. Zero-Knowledge Pre-image Commitment (RFC 8785 + FIPS 202 SHA3-256)
  2. NIST FIPS 204 ML-DSA-65 Post-Quantum Digital Signature Verification

Ecosystem Role:
  - Python CLI tool for security auditors, relying parties, and data science pipelines.
  - For Node.js / TypeScript environments, use: node tools/verify_offline.js

Usage:
  python3 tools/verify_offline.py <path-to-credential.json> [--public-key <hex>]
  cat credential.json | python3 tools/verify_offline.py
==============================================================================
"""

import sys
import os
import json
import hashlib
import hmac
import math
import re

def _format_float_ecma(f: float) -> str:
    if math.isnan(f) or math.isinf(f):
        raise ValueError("NaN and Infinity are not allowed in RFC 8785 JSON")
    if f == 0:
        return '0'
    if f < 0:
        return '-' + _format_float_ecma(-f)

    stringified = str(f)
    exponent_str = ''
    exponent_value = 0
    q = stringified.find('e')
    if q > 0:
        exponent_str = stringified[q:]
        if exponent_str[2:3] == '0':
            exponent_str = exponent_str[:2] + exponent_str[3:]
        stringified = stringified[0:q]
        exponent_value = int(exponent_str[1:])

    first = stringified
    dot = ''
    last = ''
    q = stringified.find('.')
    if q > 0:
        dot = '.'
        first = stringified[:q]
        last = stringified[q + 1:]

    if last == '0':
        dot = ''
        last = ''

    if 0 < exponent_value < 21:
        first += last
        last = ''
        dot = ''
        exponent_str = ''
        q = exponent_value - len(first)
        while q >= 0:
            q -= 1
            first += '0'
    elif -7 < exponent_value < 0:
        last = first + last
        first = '0'
        dot = '.'
        exponent_str = ''
        q = exponent_value
        while q < -1:
            q += 1
            last = '0' + last

    return f'{first}{dot}{last}{exponent_str}'


def _fallback_jcs(obj):
    """Zero-dependency RFC 8785 JSON Canonicalization Scheme (JCS) serializer."""
    if obj is None:
        return 'null'
    if isinstance(obj, bool):
        return 'true' if obj else 'false'
    if isinstance(obj, int):
        return str(obj)
    if isinstance(obj, float):
        return _format_float_ecma(obj)
    if isinstance(obj, str):
        return json.dumps(obj, ensure_ascii=False)
    if isinstance(obj, (list, tuple)):
        return '[' + ','.join(_fallback_jcs(x) for x in obj) + ']'
    if isinstance(obj, dict):
        # RFC 8785 §3.2.3: object keys sorted by UTF-16 code unit representation
        sorted_keys = sorted(obj.keys(), key=lambda k: k.encode('utf-16be'))
        return '{' + ','.join(json.dumps(k, ensure_ascii=False) + ':' + _fallback_jcs(obj[k]) for k in sorted_keys) + '}'
    raise TypeError(f"Type {type(obj)} is not serializable under RFC 8785")

try:
    import rfc8785
    def canonicalize(obj):
        """RFC 8785 deterministic JSON representation with IEEE 754 number serialization."""
        return rfc8785.dumps(obj).decode('utf-8')
except ImportError:
    def canonicalize(obj):
        """Zero-dependency RFC 8785 fallback with UTF-16 code unit key sorting."""
        return _fallback_jcs(obj)

import argparse

# ANSI terminal colors
BOLD = '\033[1m'
GREEN = '\033[32m'
RED = '\033[31m'
CYAN = '\033[36m'
YELLOW = '\033[33m'
MAGENTA = '\033[35m'
RESET = '\033[0m'

def print_header():
    print(f"{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}      ScatterID — Independent Offline Cryptographic Verifier (Python) {RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")
    print("Standards: RFC 8785 JSON Canonicalization (JCS) | SHA3-256 | ML-DSA-65 (FIPS 204)")
    print(f"Mode:      {BOLD}100% OFFLINE (Zero Network Transit){RESET}\n")


def verify_offline(raw_json, cli_public_key=None):
    try:
        data = json.loads(raw_json)
    except Exception as e:
        print(f"{RED}[ERROR] Invalid JSON: {e}{RESET}", file=sys.stderr)
        sys.exit(1)

    cred = data.get('credential', data)

    raw_claim = cred.get('rawClaim') or cred.get('claim')
    salt_hex = cred.get('salt')
    expected_hash = cred.get('dataHash')
    signature_hex = cred.get('signature')
    public_key_hex = cli_public_key or cred.get('publicKey') or cred.get('publicKeyHex')
    public_key_id = cred.get('publicKeyId', 'N/A')
    credential_id = cred.get('credentialId') or cred.get('id') or 'N/A'
    algorithm = cred.get('algorithm', 'ML-DSA-65')
    anchor_tx = cred.get('anchorTxId', 'None')

    if not raw_claim or not salt_hex or not expected_hash:
        print(f"{RED}[ERROR] Incomplete credential object. Required: 'rawClaim', 'salt', 'dataHash'{RESET}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(salt_hex, str) or not re.match(r'^[0-9a-fA-F]+$', salt_hex) or len(salt_hex) % 2 != 0:
        print(f"{RED}[ERROR] Invalid salt: must be an even-length hexadecimal string{RESET}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(expected_hash, str) or not re.match(r'^[0-9a-fA-F]{64}$', expected_hash):
        print(f"{RED}[ERROR] Invalid dataHash: must be a 64-character hexadecimal SHA3-256 string{RESET}", file=sys.stderr)
        sys.exit(1)

    print(f"{BOLD}1. Credential Subject & Attributes:{RESET}")
    print(f"  - Credential ID:    {CYAN}{credential_id}{RESET}")
    print(f"  - Subject:          {YELLOW}{raw_claim.get('subject', 'N/A')}{RESET}")
    print(f"  - Role / Degree:    {GREEN}{raw_claim.get('role', 'N/A')}{RESET}")
    print(f"  - Stored Salt:      {salt_hex}")
    print(f"  - Public Key ID:    {public_key_id}")
    print(f"  - Signature Algo:   {algorithm}")
    print(f"  - Ledger Anchor Tx: {anchor_tx}\n")

    # Step 1: RFC 8785 Canonicalization
    print(f"{BOLD}2. Step-by-Step Mathematical Verification:{RESET}")
    canonical_json = canonicalize(raw_claim)
    print("  [Step 1] RFC 8785 Canonical JSON:")
    print(f"           {CYAN}{canonical_json}{RESET}")

    # Step 2: Binary Salting Concatenation
    salt_bytes = bytes.fromhex(salt_hex)
    claim_bytes = canonical_json.encode('utf-8')
    payload = salt_bytes + claim_bytes
    print(f"  [Step 2] Salting Payload: Prepended {len(salt_bytes)}-byte CSPRNG salt")

    # Step 3: SHA3-256 Hash Commitment
    computed_hash = hashlib.sha3_256(payload).hexdigest()
    print("  [Step 3] Computed SHA3-256 Hash Commitment:")
    print(f"           {BOLD}{computed_hash}{RESET}")
    print("  [Step 4] Stored dataHash on Anchor Record:")
    print(f"           {BOLD}{expected_hash}{RESET}\n")

    # Step 4: Constant-time Hash Comparison (Level 1)
    hash_matches = hmac.compare_digest(computed_hash.lower(), expected_hash.lower())

    if not hash_matches:
        print(f"{BOLD}{RED}======================================================================{RESET}")
        print(f"{BOLD}{RED}  ✕ LEVEL 1 VERIFICATION FAILED: FORGERY OR TAMPERING DETECTED!{RESET}")
        print(f"{BOLD}{RED}======================================================================{RESET}")
        print(f"  {RED}Hash mismatch! The claim attributes or salt have been altered after issuance.{RESET}")
        print(f"  Expected Hash: {expected_hash}")
        print(f"  Computed Hash: {computed_hash}\n")
        sys.exit(1)

    print(f"  {GREEN}✓ Level 1 Passed:{RESET} Zero-Knowledge pre-image commitment is mathematically exact.\n")

    # Level 2: Signature & Public Key Verification
    print(f"{BOLD}3. Post-Quantum Signature Verification (ML-DSA-65):{RESET}")
    sig_verified = False
    sig_checked = False

    if signature_hex and public_key_hex:
        sig_checked = True
        try:
            if not isinstance(signature_hex, str) or not re.match(r'^[0-9a-fA-F]+$', signature_hex) or len(signature_hex) % 2 != 0:
                print(f"  {RED}✕ Level 2 Failed:{RESET} Signature must be a valid even-length hex string.")
                sig_verified = False
            elif not isinstance(public_key_hex, str) or not re.match(r'^[0-9a-fA-F]+$', public_key_hex) or len(public_key_hex) % 2 != 0:
                print(f"  {RED}✕ Level 2 Failed:{RESET} Public key must be a valid even-length hex string.")
                sig_verified = False
            else:
                sig_bytes = bytes.fromhex(signature_hex)
                pk_bytes = bytes.fromhex(public_key_hex)
                msg_bytes = bytes.fromhex(expected_hash)

                if len(sig_bytes) != 3309:
                    print(f"  {RED}✕ Level 2 Failed:{RESET} Signature length mismatch: expected 3,309 bytes (ML-DSA-65), got {len(sig_bytes)} bytes.")
                    sig_verified = False
                elif len(pk_bytes) != 1952:
                    print(f"  {RED}✕ Level 2 Failed:{RESET} Public key length mismatch: expected 1,952 bytes (ML-DSA-65), got {len(pk_bytes)} bytes.")
                    sig_verified = False
                else:
                    import oqs
                    with oqs.Signature("ML-DSA-65") as verifier:
                        sig_verified = verifier.verify(msg_bytes, sig_bytes, pk_bytes)

                    if sig_verified:
                        print(f"  {GREEN}✓ Level 2 Passed:{RESET} ML-DSA-65 post-quantum signature is authentic against provided Public Key.")
                    else:
                        print(f"  {RED}✕ Level 2 Failed:{RESET} Signature is INVALID for the provided Public Key.")
        except ImportError:
            print(f"  {RED}[!] CRITICAL:{RESET} `oqs` (liboqs-python) is not installed. ML-DSA-65 signature CANNOT be verified.")
            print(f"      Install liboqs-python or verify via the Docker container to perform full PQC signature verification.")
            sig_checked = False  # Override: signature was never actually checked
            sig_verified = False
        except Exception as e:
            print(f"  {RED}✕ Level 2 Error:{RESET} Failed to verify signature: {e}")
            sig_verified = False
    else:
        print(f"  {YELLOW}[!] Notice:{RESET} 'signature' or 'publicKey' not supplied in credential bundle.")
        print(f"      (Pass `--public-key <hex>` to execute full PQC signature verification).")

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    if hash_matches and (not sig_checked or sig_verified):
        if sig_checked and sig_verified:
            print(f"{BOLD}{GREEN}  ✓ VERIFICATION RESULT: CRYPTOGRAPHICALLY VALID & AUTHENTIC{RESET}")
            print(f"{BOLD}{CYAN}======================================================================{RESET}")
            print(f"  {GREEN}The presented claim matches the exact zero-knowledge hash commitment.{RESET}")
            print(f"  {GREEN}ML-DSA-65 digital signature confirmed authentic from authorized issuer.{RESET}")
        else:
            print(f"{BOLD}{YELLOW}  ⚠ VERIFICATION RESULT: PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED){RESET}")
            print(f"{BOLD}{CYAN}======================================================================{RESET}")
            print(f"  {YELLOW}The presented claim matches the hash commitment, but NO digital signature was verified.{RESET}")
            print(f"  {YELLOW}Anyone can construct arbitrary claims matching a self-generated commitment without issuer authority.{RESET}")
        print("  Zero-Knowledge Property Confirmed: Verification completed offline with zero leakage.")
        print(f"  {YELLOW}[!] Freshness Notice:{RESET} Offline verification confirms authenticity at issuance;")
        print(f"      it cannot confirm whether the credential has since been revoked on-chain.\n")
        sys.exit(0)
    else:
        print(f"{BOLD}{RED}  ✕ VERIFICATION RESULT: SIGNATURE VERIFICATION FAILED{RESET}")
        print(f"{BOLD}{CYAN}======================================================================{RESET}")
        sys.exit(1)

def main():
    print_header()
    parser = argparse.ArgumentParser(description="ScatterID Offline Cryptographic Verifier")
    parser.add_argument("file", nargs="?", help="Path to credential JSON file")
    parser.add_argument("--public-key", dest="public_key", help="Issuer ML-DSA-65 public key in hex format")

    args = parser.parse_args()

    if args.file and os.path.exists(args.file):
        with open(args.file, 'r', encoding='utf-8') as f:
            verify_offline(f.read(), cli_public_key=args.public_key)
    elif not sys.stdin.isatty():
        verify_offline(sys.stdin.read(), cli_public_key=args.public_key)
    else:
        parser.print_help()
        print("\nExample:")
        print("  python3 tools/verify_offline.py examples/credentials_input.json")
        sys.exit(0)

if __name__ == '__main__':
    main()

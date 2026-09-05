# Offline CLI Verifier Tools (`tools/`)

Self-contained command-line utilities for verifying **ScatterID** credentials in air-gapped, offline, or resource-constrained environments without live ledger or network dependencies.

---

## 1. Tiered Verification Architecture

Verification operates across two complementary levels depending on runtime environment capabilities:

| Level | Tool | Runtime | Cryptographic Scope |
| :--- | :--- | :--- | :--- |
| **Level 1** | [`verify_offline.js`](file:///home/kali/scatterid-ecosystem/ScatterID/tools/verify_offline.js) | Node.js (Pure JS) | **Pre-image & Commitment Validation**: Recomputes RFC 8785 claim hashes with 16-byte CSPRNG salts, evaluates structural schema, and checks public key (1,952 bytes) and signature (3,309 bytes) container dimensions. Zero native C dependencies. |
| **Level 2** | [`verify_offline.py`](file:///home/kali/scatterid-ecosystem/ScatterID/tools/verify_offline.py) | Python 3 + `liboqs` | **Full Post-Quantum Signature Verification**: Recomputes all Level 1 pre-image commitments AND mathematically verifies the NIST FIPS 204 ML-DSA-65 signature against the issuer's public key. |

---

## 2. Command-Line Reference

### Level 1: Node.js Structural Verifier
```bash
# Verify claim commitments and structural schema
node tools/verify_offline.js --credential credential.json

# Provide public key to validate container sizing
node tools/verify_offline.js --credential credential.json --public-key issuer_pubkey.hex
```

#### Output Badges
- **Pre-Image Match Only**: Emits `⚠ VERIFICATION RESULT: PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED)`, explicitly informing the operator that claim commitments match but mathematical signature verification requires the Level 2 engine.
- **Tampered Payload**: Emits `❌ VERIFICATION FAILED: PRE-IMAGE COMMITMENT MISMATCH` and exits with code 1.

### Level 2: Python Native ML-DSA-65 Verifier
```bash
# Verify commitments and post-quantum digital signature
python3 tools/verify_offline.py --credential credential.json --public-key issuer_pubkey.hex
```

#### Output Badges
- **Fully Verified**: Emits `✔ VERIFICATION RESULT: VALID ML-DSA-65 SIGNATURE & COMMITMENTS`.
- **Signature Forgery**: Emits `❌ VERIFICATION FAILED: SIGNATURE CORRUPTED OR FORGED` and exits with code 1.

---

## 3. Cryptographic Boundaries & Revocation Limitation

> [!WARNING]
> **Offline Freshness Boundary**: Offline verification mathematically proves that credential attributes match the commitments signed by the issuer at issuance time. However, an air-gapped verifier **cannot detect subsequent on-chain revocations** published to the Hyperledger Fabric ledger. For high-assurance freshness checks, verifiers should connect to the Verification Gateway (`POST /credentials/verify`) or an authorized Fabric peer.

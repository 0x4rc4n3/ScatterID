# Post-Quantum Cryptographic Microservice (`crypto-service`)

A dedicated post-quantum signing authority and key management service for **ScatterID**, implementing NIST FIPS 204 (ML-DSA-65) signatures and NIST FIPS 202 (SHA3-256) hashing.

---

## 1. Architecture & Core Responsibilities

The cryptographic microservice operates as an isolated signing oracle within the ScatterID internal network. It exposes a hardened REST interface protected by mutual TLS (mTLS) and API key authentication:

```
+------------------------+      mTLS + API Key      +-----------------------------+
|    Verification API    | -----------------------> |       Crypto Service        |
|    (Node.js / :3000)   |  POST /sign_hash         |      (Flask / Python 3.11)  |
|                        |  POST /verify_hash       |                             |
+------------------------+                          +--------------+--------------+
                                                                   |
                                            +----------------------+----------------------+
                                            |                      |                      |
                                            v                      v                      v
                                    +---------------+      +---------------+      +---------------+
                                    |    liboqs     |      |  Vault KMS    |      | Local Backup  |
                                    | (ML-DSA-65 C) |      |   (KV v2)     |      |  (Atomic IO)  |
                                    +---------------+      +---------------+      +---------------+
```

1. **Deterministic Quantum-Resistant Signing**: Signs RFC 8785 claim hashes using ML-DSA-65 without exposing raw private keys to general application tiers.
2. **Signature Verification**: Verifies ML-DSA-65 signatures against provided public keys and claim hashes.
3. **KMS & Storage Integration**: Interacts with HashiCorp Vault KV-v2 for persistent key storage and AppRole authentication, with atomic local state fallbacks.

---

## 2. Cryptographic Specifications

| Parameter | Specification | Standard |
| :--- | :--- | :--- |
| **Signature Scheme** | ML-DSA-65 (Dilithium3) | NIST FIPS 204 |
| **Security Level** | Category 3 (AES-192 equivalent) | NIST PQC Standard |
| **Hash Algorithm** | SHA3-256 (Keccak) | NIST FIPS 202 |
| **Public Key Size** | 1,952 bytes | Fixed length |
| **Signature Size** | 3,309 bytes | Fixed length |
| **Internal Transport** | TLS 1.3 / mTLS (RSA-2048 / ECDSA) | RFC 8446 |

---

## 3. C Memory Management & Lifecycle

Because ML-DSA operations wrap native C implementations in `liboqs`, strict lifecycle management is enforced:

- **Explicit Instance Cleanup**: Every allocation of `oqs.Signature` is wrapped in a `try ... finally` block that deterministically calls `instance.free()`. This prevents memory leaks across continuous high-throughput signing and verification workloads.
- **Memory Zeroization**: Following signature generation, sensitive private key buffers are zeroized in memory using `ctypes.memset` prior to garbage collection.
- **Atomic Disk Writes**: Local key backup metadata operations in `kms.py` utilize temporary file creation (`.tmp`) followed by atomic rename (`os.replace`) to prevent file corruption during power failures or container halts.

---

## 4. API Reference

All requests require HTTP Header: `X-API-Key: <CRYPTO_SERVICE_API_KEY>`.

### `POST /sign_hash`
Generates an ML-DSA-65 signature over a SHA3-256 hash.
- **Request Body**:
  ```json
  {
    "hash": "a1b2c3d4e5... (64-char hex string)"
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "status": "success",
    "signature": "<hex-encoded-signature>",
    "public_key": "<hex-encoded-public-key>",
    "algorithm": "ML-DSA-65"
  }
  ```

### `POST /verify_hash`
Verifies an ML-DSA-65 signature against a SHA3-256 hash and public key.
- **Request Body**:
  ```json
  {
    "hash": "a1b2c3d4e5...",
    "signature": "<hex-encoded-signature>",
    "public_key": "<hex-encoded-public-key>"
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "valid": true,
    "algorithm": "ML-DSA-65"
  }
  ```

### `GET /health`
Liveness and readiness probe verifying liboqs initialization and Vault KMS connectivity.

---

## 5. Testing & Verification

The microservice includes an automated unit and interface test suite:

```bash
# Execute within the crypto-service container:
docker run --rm -v $(pwd)/components/crypto/crypto-service:/app -w /app scatterid-crypto python test_interface.py

# Or on a host environment with liboqs and requirements installed:
python3 components/crypto/crypto-service/test_interface.py
```

### Coverage
- **15/15 tests covering**:
  - Keypair generation and key serialization
  - Signature generation and verification parity
  - Invalid hex and corrupted signature rejection
  - Memory cleanup and `free()` invocation guarantees
  - Vault AppRole authentication and atomic disk backup

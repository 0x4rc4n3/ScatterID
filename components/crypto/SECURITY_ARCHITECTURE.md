# Cryptographic Security Architecture & Threat Model

This document clarifies the cryptographic security model, trust boundaries, and known architectural considerations across the ScatterID cryptographic services.

---

## 1. Credential Layer vs. Transport Layer Cryptography

| Layer | Cryptographic Primitive | Standard | Threat Mitigation / Status |
| :--- | :--- | :--- | :--- |
| **Identity & Credential Signatures** | **ML-DSA-65 (Dilithium3)** | NIST FIPS 204 | Quantum-resistant; valid against future quantum decryption. |
| **Commitments & Zero-Knowledge Hashes** | **SHA3-256 (Keccak)** | NIST FIPS 202 | Quantum collision and preimage resistant (256-bit security). |
| **Microservice mTLS Transport** | **RSA-2048 / TLS 1.3** | RFC 8446 | Classical security today; subject to Harvest-Now-Decrypt-Later (HNDL). |

### Harvest-Now-Decrypt-Later (HNDL) Note
- Internal microservice traffic between `verification-api` and `crypto-service` is protected by TLS using RSA-2048 / ECDSA certificates.
- While the credentials created and verified are themselves permanently immune to quantum cryptanalysis, traffic transiting the internal Docker bridge network could hypothetically be captured and decrypted retroactively once cryptanalytically relevant quantum computers (CRQCs) exist.
- **Roadmap Mitigation**: Transition internal service proxies to hybrid post-quantum key exchange (X25519 + ML-KEM-768 / Kyber) as upstream TLS libraries achieve production stability.

---

## 2. Key Management Service (KMS) & Signing Boundary

### Supported Architectures: Vault Transit (Isolated) vs. Vault KV v2 (Legacy)

| Dimension | Vault Transit / HSM Isolated (`transit`) | Vault KV v2 In-Memory (`kv`) |
| :--- | :--- | :--- |
| **Private Key Custody** | **Strictly encapsulated** inside Vault Transit / HSM boundary | Retrieved into application runtime process memory |
| **Exposure to RCE** | **Zero key material exposure** (attacker gains signing capability only, cannot exfiltrate unexportable key) | Potential raw private key exposure in process heap/stack |
| **Memory Invariant** | `PRIVATE_KEY is None` in application space; `zeroize()` invoked immediately | Mutable bytearray zeroization via `ctypes.memset` |
| **Configuration** | `VAULT_SIGNING_MODE=transit` | `VAULT_SIGNING_MODE=kv` (legacy / local dev) |
| **Signature Interface** | `kms.sign_digest(hash_bytes)` | `pq_sign.sign_data(hash_bytes, private_key)` |

### Vault Transit / HSM Boundary Architecture
- When `VAULT_SIGNING_MODE=transit` is enabled, `crypto-service` never holds private key bytes in application memory.
- `kms.get_keys()` returns `(public_key, None)`: the public key is registered in `public_key_history` and exposed for verification, while the private key remains locked inside the cryptographic enclosure.
- Signature requests on `/sign_hash` transmit only the 32-byte pre-image hash across the boundary via `kms.sign_digest()`, receiving back an NIST FIPS 204 ML-DSA-65 signature without key material ever crossing into process memory.
- Even in the event of an arbitrary code execution (RCE) inside the `crypto-service` container, the attacker cannot dump or exfiltrate the master ML-DSA-65 private key.
- Operational health probes on `/healthz` report `"signingBoundary": "vault_transit_isolated"`, allowing security monitoring tools and audit policies to continuously assert hardware/transit isolation.

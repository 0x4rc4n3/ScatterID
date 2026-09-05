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

### Current Model: Vault KV v2 with In-Memory Signing
- The root ML-DSA-65 signing keypair is stored in HashiCorp Vault's KV v2 secrets engine (`scatterid/mldsa`).
- During signature generation, the private key bytes are retrieved into Python process memory over a secure TLS session, loaded into liboqs, and used to sign the claim hash.
- Following signing, best-effort memory zeroization is executed on mutable bytearrays via `ctypes.memset`.

### Threat Model Consideration
- Because raw private key bytes reside briefly in `crypto-service` process memory during signing, a Remote Code Execution (RCE) vulnerability in `crypto-service` could potentially exfiltrate the active signing key, rather than being restricted to an unexportable signing capability.
- **Roadmap Mitigation**: Migration to Vault Transit engine or dedicated Hardware Security Module (HSM) with PQC support, enabling signatures to be computed strictly inside the tamper-resistant hardware boundary without exposing private key bytes to application memory.

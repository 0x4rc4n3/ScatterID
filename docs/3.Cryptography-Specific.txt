> NOTE: This document reflects the original v1 architecture. ScatterID has since been upgraded to a Zero-Knowledge hashing model (v2). Please refer to the root README.md and docs/ScatterID Architecture.txt for current technical specifications.

# Cryptography-Specific Details

## Data-Retention Guarantee

Per credential, ScatterID's database and ledger store ONLY:
- credentialId (UUID)
- dataHash (salted hash, hex)
- signature (ML-DSA-65 signature over dataHash, hex)
- publicKeyId (pointer to issuer's public key in ScatterID's own key registry)
- algorithm (e.g., ML-DSA-65)
- issuedAt (ISO 8601 timestamp)
- status / anchorTxId (revocation + chain-anchor bookkeeping)

**ScatterID explicitly NEVER stores:**
- The raw claim data.
- The 16-byte CSPRNG salt.

Hashing (using RFC 8785 JCS canonicalization and a 16-byte CSPRNG salt) happens entirely client-side via the ScatterID SDK. Only the resulting `dataHash` is ever transmitted to the ScatterID backend.

## Summary of All Technical Decisions

| Category | Decision |
|----------|----------|
| **Primary Language/Stack** | Python (crypto module), Node.js (API + SDK) |
| **PQC Signature Algorithm** | ML-DSA-65 (CRYSTALS-Dilithium, NIST FIPS 204) |
| **Secret-Sharing Scheme** | Removed (Zero-knowledge hashing model used instead) |
| **Anchoring Chain** | Sepolia testnet / specific PQC-readying chain |
| **Database (MVP)** | SQLite for local dev, Postgres for shared staging |
| **Hashing Algorithm** | SHA3-256 with 16-byte CSPRNG Salt (RFC 8785 JCS Canonicalization) |
| **API Auth (MVP)** | Static API key per module team |
| **Key Storage (MVP)** | Environment variables |
| **Key Storage (Production)** | Hardware Security Module (HSM) or HashiCorp Vault |
| **Randomness Source** | Node.js: `crypto.randomBytes()` |
| **Library Versioning** | Pinned exactly |
| **Endpoint 1** | POST /issue — issue new signed credential |
| **Endpoint 2** | POST /verify — verify credential |
| **Endpoint 3** | GET /status/{id} — get credential status |
| **Authentication** | Bearer <API_KEY> in Authorization header |
| **API Response (Error)** | {error: string, code: string} |
| **Chaincode Language** | Go (Fabric's most mature) |
| **SDK Methods** | issue, verifyByHash, verifyByClaim, getStatus |

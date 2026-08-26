# ScatterID — Post-Quantum Identity Verification Infrastructure

[![CI](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/ci.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/codeql.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/codeql.yml)
[![Security: Gitleaks](https://img.shields.io/badge/Security-Gitleaks-blue.svg)](https://github.com/gitleaks/gitleaks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

ScatterID is a decentralized, zero-knowledge, post-quantum identity verification system.

---

## 🚀 Quickstart (Zero-to-Running in 60 Seconds)

ScatterID is designed to be completely self-sufficient and runnable on any standard Linux/macOS host with Docker installed:

```bash
# 1. Clone the repository
git clone https://github.com/0x4rc4n3/ScatterID-product.git
cd ScatterID-product

# 2. Launch the full turnkey stack (auto-generates keys, certs, and boots ledger & services)
./quickstart.sh
```

Once initialized, the following services are live:
- **Interactive Live Presentation Demo:** [http://localhost:4000/demo](http://localhost:4000/demo)
- **Operator Diagnostics Console:** [http://localhost:4000](http://localhost:4000)
- **Verification Gateway API:** `http://localhost:3000`
- **Post-Quantum Crypto Microservice (ML-DSA-65):** `https://localhost:5001`
- **HashiCorp Vault KMS:** `http://localhost:8200`

### Verify the Stack with the E2E Test Suite:
```bash
./test_all.sh
```

### 🎮 Visual SDK Playground & Interactive Demo:
ScatterID includes a dedicated graphical web app that connects directly to the TypeScript/JavaScript SDK:
```bash
cd examples/web-app && npm start
# Open http://localhost:5050 in your browser
```
- **Live 10-Preset Selector:** Load realistic sample claims across 10 industries (Medicine, Aviation, Cybersecurity, Legal, KYC).
- **Real-Time Cryptographic Telemetry:** Watch the local RFC 8785 canonicalization, CSPRNG salting, SHA3-256 zero-knowledge hashing, and ML-DSA-65 signing pipeline.
- **Interactive Tamper Testing:** Corrupt a single field in the presented claim with 1-click and watch the verification engine detect and reject the forgery.
- **Lifecycle & Updates:** Experience the "Revoke & Supersede" pattern by updating an active credential on the blockchain.

### 🛡️ "Don't Trust, Verify" — Standalone Offline CLI Verifier:
ScatterID empowers third-party auditors and relying parties to mathematically verify any issued credential **100% offline** with zero external network or server dependencies:

```bash
# Verify a credential JSON file completely offline (pure math, no server needed)
node tools/verify_offline.js <path-to-credential.json>
```

---

## 🏛 Core Architectural Flow

```mermaid
sequenceDiagram
    participant User
    participant SDK (Org Backend)
    participant Gateway as Verification API
    participant Crypto as Crypto Service (PQC)
    participant Fabric as Hyperledger Fabric

    rect rgb(230, 245, 255)
    note right of User: Phase 1: Issuance
    User->>SDK (Org Backend): Provide Claim Data
    SDK (Org Backend)->>SDK (Org Backend): Canonicalize (RFC 8785 JCS)
    SDK (Org Backend)->>SDK (Org Backend): Generate 16-byte CSPRNG Salt
    SDK (Org Backend)->>SDK (Org Backend): Compute dataHash = SHA3-256(Salt || CanonicalizedClaim)
    SDK (Org Backend)->>Gateway: POST /issue { dataHash, idempotencyKey }
    Gateway->>Crypto: POST /sign_hash { dataHash } (HTTPS + Bearer Auth)
    Crypto->>Crypto: Sign dataHash using NIST ML-DSA-65 (Dilithium3)
    Crypto-->>Gateway: Return { credentialId, dataHash, signature, publicKeyId }
    Gateway->>Fabric: Invoke AnchorCredential(credentialId, dataHash, algo, sig)
    Fabric-->>Gateway: Return TxID (Committed)
    Gateway-->>SDK (Org Backend): Return { status: "anchored", credentialId, signature, publicKeyId }
    SDK (Org Backend)-->>User: Return full credential object including salt (Store Safely)
    end

    rect rgb(255, 245, 238)
    note right of User: Phase 2: Zero-Knowledge Verification
    User->>SDK (Org Backend): Present Claim + Salt + Credential ID
    SDK (Org Backend)->>SDK (Org Backend): Recompute dataHash = SHA3-256(Salt || CanonicalizedClaim)
    SDK (Org Backend)->>Gateway: POST /verify { dataHash, credentialId }
    Gateway->>Crypto: POST /verify_hash { dataHash, signature, publicKeyId }
    Crypto->>Crypto: Lookup Public Key by publicKeyId (from internal registry)
    Crypto->>Crypto: Verify ML-DSA-65 Signature
    Crypto-->>Gateway: Return { valid: true }
    Gateway->>Fabric: Query VerifyAnchor(credentialId, dataHash)
    Fabric-->>Gateway: Return { anchorStatus: "active" }
    Gateway-->>SDK (Org Backend): Return { valid: true, anchorStatus: "active" }
    SDK (Org Backend)-->>User: Validated!
    end
```

---

## 🏛 Cryptographic Security Guarantees & Boundaries

### 1. Post-Quantum Signature Scheme (ML-DSA-65 / Dilithium3)
- **Standard**: NIST FIPS 204 Standard.
- **Security Category**: Category 3.
- **Security Property**: EUF-CMA.

### 2. Zero-Knowledge Hashing Model
- **Hashing Algorithm**: SHA3-256 over an RFC 8785 (JCS) canonicalized JSON payload, concatenated with a 16-byte CSPRNG Salt.
- **Data Retention Guarantee**: ScatterID NEVER stores raw claim data, salts, or any reconstructable fragments. It stores strictly the UUID, dataHash, signature, publicKeyId, and ledger anchor info.

### 3. Public Key Trust Boundary
- Verification exclusively resolves the issuer's public key from ScatterID's internal trusted key registry.

---

## 🔒 Inter-Service Network Security

1. **Bearer Token Authentication**:
   - `CRYPTO_SERVICE_API_KEY`: Every request to `crypto-service:5001` enforces TLS 1.3 encryption and Bearer Token header validation.
2. **HashiCorp Vault Key Management**:
   - Root keys are provisioned in HashiCorp Vault KV v2 secret engine.

---

## 📁 Repository Structure

```
ScatterID/
├── components/
│   ├── crypto/                 # PQC Engine & Zero-Knowledge ML-DSA Signer
│   ├── verification-api/       # Core Express Verification Gateway
│   ├── project-dashboard/      # Deep-Tech Operator Dashboard & Diagnostics Engine
│   └── blockchain/             # Hyperledger Fabric Go Chaincode & Mutual TLS Network
├── sdk/                        # TypeScript/JavaScript SDK for issuing and verifying credentials
├── docs/                       # Architectural & Technical Design Specifications
├── docker-compose.yml          # Multi-Container Topology Orchestration
├── test_all.sh                 # E2E Integration Test Suite
└── README.md                   # Master Architectural Documentation
```

---

## Current Limitations

ScatterID is an active research and development project. The following limitations are acknowledged honestly:

- **No independent security audit** has been performed. The codebase has undergone internal review but has not been evaluated by an external security firm.
- **Test coverage is smoke-level**, not comprehensive. Unit and integration tests exist for core flows, but full edge-case and failure-mode coverage is a work in progress.
- **The default `docker-compose.yml` configuration is for local development only** and is not hardened for production deployment. Vault runs in dev mode (`VAULT_DEV_MODE=true`) over HTTP, and TLS certificates are self-signed.
- **CI includes linting, tests, and build verification** but does not yet include SAST or comprehensive dependency scanning beyond `npm audit` / `pip-audit`.
- **Documentation reflects the current v2 zero-knowledge architecture**; supplementary docs in `docs/` may reference design decisions that predate the current implementation.

See [CHANGELOG.md](CHANGELOG.md) for the full history of changes and resolved issues.

---

## Security Note
**MANUAL REVIEW REQUIRED**: Any version bumps to cryptographic dependencies (`flask`, `hvac`, `liboqs-python`, and any `crypto` JS packages) require manual review of changelogs before upgrading. Do not use caret (`^`) or tilde (`~`) version ranges for these packages.

For reporting security vulnerabilities, see [SECURITY.md](SECURITY.md). For contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).


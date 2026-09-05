# ScatterID — Post-Quantum Identity Verification Infrastructure

[![Website](https://img.shields.io/badge/Website-scatterid.tech-blue.svg)](https://www.scatterid.tech/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0x4rc4n3-blue.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/0x4rc4n3)
[![CI](https://github.com/0x4rc4n3/ScatterID/actions/workflows/ci.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0x4rc4n3/ScatterID/actions/workflows/codeql.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID/actions/workflows/codeql.yml)
[![Security: Gitleaks](https://img.shields.io/badge/Security-Gitleaks-blue.svg)](https://github.com/gitleaks/gitleaks)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

ScatterID is an open-source, decentralized, zero-knowledge identity verification infrastructure. It provides a reference framework for organizations to issue, anchor, and mathematically verify privacy-preserving digital credentials resilient against post-quantum cryptographic threats.

By combining **NIST FIPS 204 (ML-DSA-65)** post-quantum digital signatures, client-side **RFC 8785 (JCS)** canonicalization with cryptographic salting, and **Hyperledger Fabric** permissioned blockchain anchoring, ScatterID enforces strict data minimization: raw identity attributes never leave the client device.

---

## Architectural Highlights

* **Post-Quantum Digital Signatures (NIST FIPS 204):** Implements ML-DSA-65 (formerly CRYSTALS-Dilithium3) lattice-based digital signatures to secure credentials against quantum computing cryptanalysis (Shor's algorithm).
* **Zero-Knowledge Data Minimization:** Raw claim data is canonicalized locally and salted with a 16-byte CSPRNG secret. Only a one-way `SHA3-256` commitment is ever transmitted to the network. ScatterID never stores, processes, or logs plaintext identity attributes.
* **Immutable Blockchain Anchoring:** Cryptographic proof commitments and revocation states are permanently anchored to a permissioned Hyperledger Fabric ledger with Raft consensus.
* **Standalone Offline Verification:** Verifiers and auditors can validate credentials air-gapped without internet access or blockchain connectivity using zero-dependency CLI tools.
* **Turnkey Single-Command Provisioning:** Complete microservice topology (Vault KMS, PQC Crypto Microservice, Verification Gateway, Fabric Consortium, and Web Diagnostics Console) initializes out of the box with zero manual configuration.

---

## Quickstart

ScatterID runs on standard Linux and macOS environments with **Docker** and **Docker Compose** installed.

```bash
# 1. Clone the repository
git clone https://github.com/0x4rc4n3/ScatterID.git
cd ScatterID

# 2. Launch the turnkey stack (provisions keys, mTLS certificates, ledger, and services)
./scripts/quickstart.sh
```

### Operational Profiles
* **Core Microservices (`./scripts/start.sh` or `docker compose up -d`):**  
  Launches core microservices (PQC Crypto Engine, Verification Gateway API, Hyperledger Fabric ledger, HashiCorp Vault). Note: Web dashboards and client portals have been decommissioned for a clean ground-up redesign.

---

### Local Service Endpoints
| Service | Endpoint | Description |
| :--- | :--- | :--- |
| **Verification Gateway API** | `http://localhost:3000` | REST API for credential issuance, verification, and revocation |
| **PQC Crypto Service** | `https://localhost:5001` | High-security ML-DSA-65 signing engine (internal mTLS) |
| **HashiCorp Vault KMS** | `http://localhost:8200` | Key management service holding post-quantum keypairs |

---

### Automated Test Suite
```bash
./scripts/test_all.sh
```

---

## Standalone Offline Verification

Auditors and relying parties can mathematically validate any issued credential **100% offline** without network access or blockchain dependencies:

```bash
# Node.js Verifier (zero external dependencies)
# Validates RFC 8785 canonicalization, salting, SHA3-256 pre-image commitment (Level 1),
# and inspects ML-DSA-65 container structural dimensions (3309B signature / 1952B public key).
node tools/verify_offline.js <path-to-credential.json> [--public-key <hex>]

# Python Verifier (requires liboqs-python)
# Executes complete cryptographic Level 2 ML-DSA-65 post-quantum signature verification
# against the issuer's public key.
python3 tools/verify_offline.py <path-to-credential.json> [--public-key <hex>]
```

### Verifier Capabilities & Cryptographic Boundaries
| Runtime | Pre-Image Commitment (Level 1) | Container Structural Check | Mathematical ML-DSA-65 (Level 2) |
| :--- | :--- | :--- | :--- |
| **Node.js (`verify_offline.js`)** | Verified (RFC 8785 + SHA3-256) | Verified (3309B Sig / 1952B PK) | Requires liboqs (delegates to Python CLI) |
| **Python (`verify_offline.py`)** | Verified (RFC 8785 + SHA3-256) | Verified (Binary parsing) | Verified (NIST FIPS 204 via liboqs) |

> [!NOTE]
> **Offline Freshness Limitation**: Offline verification mathematically proves authenticity and integrity at the time of issuance; it cannot confirm whether the credential has since been revoked on the blockchain ledger without querying the network.

Cross-language parity is asserted across both verifiers via `./tests/offline_verify_parity.test.sh`.

---

## Technical Documentation & Specifications

Detailed architectural specifications, cryptographic proofs, and operational runbooks are available in the documentation library:

* **[Comprehensive Architecture Overview & Flowcharts](docs/architecture-overview.md)** — Interactive Mermaid diagrams covering system topology, issuance sequences, dual-mode verification protocols, and KMS key lifecycle.
* **[Master Documentation Index](docs/README.md)** — Complete catalog of technical specs, cryptography models, DevOps pipelines, security engineering, and compliance analysis.
* **[Configuration Reference (.env.example)](.env.example)** — Authoritative environment variable template and port settings.

---

## Repository Structure

```
ScatterID/
├── components/
│   ├── crypto/                 # PQC Engine & ML-DSA-65 Signer (Python / liboqs / mTLS)
│   ├── verification-api/       # Verification Gateway API, SQLite Models & Reconciliation
│   └── blockchain/             # Hyperledger Fabric Network, Raft Consensus & Go Chaincode
├── sdk/                        # Client SDK (@scatterid/sdk for TypeScript / JavaScript)
├── docs/                       # Master Architecture, Cryptography & Compliance Specifications
├── scripts/                    # Turnkey Provisioning, Startup, & E2E Test Automation
├── tools/                      # Standalone Cross-Language Offline Verifiers (JS & Python)
├── tests/                      # Integration & Cross-Language Parity Test Suites
├── docker-compose.yml          # Container Topology Orchestration
├── .env.example                # Authoritative Configuration Template
├── CHANGELOG.md                # Milestone & Release History
├── SECURITY.md                 # Security Policy & Vulnerability Reporting
├── CONTRIBUTING.md             # Developer Contribution Guidelines
├── LICENSE                     # PolyForm Noncommercial License 1.0.0
└── README.md                   # Master Project Overview
```

---

## About the Creator

ScatterID is designed and built by **Mudassir Javed** (`0x4rc4n3`), a cybersecurity graduate focused on security architecture, applied cryptography, and turning standards-track research (like NIST's post-quantum signature schemes) into deployable systems. This project is the technical centerpiece of that focus — an end-to-end reference architecture rather than a single algorithm demo, covering key management, service topology, offline verification tooling, and operational documentation.

* **LinkedIn:** [linkedin.com/in/0x4rc4n3](https://www.linkedin.com/in/0x4rc4n3)
* **Email:** [mudassirbhatti276@gmail.com](mailto:mudassirbhatti276@gmail.com)
* **Website:** [scatterid.tech](https://www.scatterid.tech/)
* **GitHub:** [github.com/0x4rc4n3](https://github.com/0x4rc4n3)

## Security Disclosures

See [SECURITY.md](SECURITY.md) for our responsible disclosure process and vulnerability response commitments.

---

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**.

**You are free to:**
* View, modify, and run the framework for personal use.
* Use the code for academic, educational, and research purposes.
* Fork and contribute to the project.

**You are NOT permitted to:**
* Use this software (or any modified version) for commercial purposes.
* Integrate this verification framework or API into a for-profit product or service.
* Sell access to the code.

# ScatterID — Post-Quantum Identity Verification Infrastructure

[![Website](https://img.shields.io/badge/Website-scatterid.tech-blue.svg)](https://www.scatterid.tech/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0x4rc4n3-blue.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/0x4rc4n3)
[![CI](https://github.com/0x4rc4n3/ScatterID/actions/workflows/ci.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0x4rc4n3/ScatterID/actions/workflows/codeql.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID/actions/workflows/codeql.yml)
[![Security: Gitleaks](https://img.shields.io/badge/Security-Gitleaks-blue.svg)](https://github.com/gitleaks/gitleaks)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

ScatterID is a source-available, decentralized, privacy-preserving identity verification infrastructure. It provides a reference framework for organizations to issue, anchor, and mathematically verify privacy-preserving digital credentials resilient against post-quantum cryptographic threats.

The TypeScript SDK canonicalizes claims locally with **RFC 8785 (JCS)**, salts and hashes them with **SHA3-256**, then sends the commitment—not the claim plaintext—to the issuance API. The API requests an **ML-DSA-65** signature and records credential status on a permissioned **Hyperledger Fabric** ledger. This describes the SDK path; deployments remain responsible for the issuer’s source data, client application, logs, and database controls.

---

## Architectural Highlights

* **Post-Quantum Digital Signatures (NIST FIPS 204):** Uses ML-DSA-65 (formerly CRYSTALS-Dilithium3) for credential signatures. The algorithm is designed to resist known classical and quantum attacks; this is not a claim of proven immunity to future cryptanalysis.
* **Hash-Commitment Data Minimization:** In the TypeScript SDK flow, the claim is canonicalized locally and combined with a 16-byte CSPRNG salt. The API receives the resulting `SHA3-256` commitment. Issuers still handle source attributes, and application-level logging or storage must be reviewed separately.
* **Ledger-Recorded Credential State:** Commitment hashes and credential lifecycle state are written to a permissioned Hyperledger Fabric ledger. Ledger durability and availability depend on the deployed Fabric configuration and operational controls.
* **Standalone Offline Verification:** Verifiers and auditors can validate credentials air-gapped without internet access or blockchain connectivity using CLI tools (Level 1 checks are zero-dependency; Level 2 signature verification requires liboqs).
* **Local Stack Scripts:** Repository scripts help provision and start the local microservice topology. Review `.env.example`, Docker requirements, and script behavior before using the stack outside a development environment.

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
* **Core Microservices & Operations Console (`./scripts/start.sh` or `docker compose up -d`):**  
  Launches core microservices (PQC Crypto Engine, Verification Gateway API, Hyperledger Fabric ledger, HashiCorp Vault) along with the Zone 2 Operations Console (`:8080`) and Zone 1 Help Desk Client Portal (`:5000`).

---

### Local Service Endpoints
| Service | Endpoint | Network Zone | Description |
| :--- | :--- | :--- | :--- |
| **Operations Console** | `http://localhost:8080` | Zone 2 (`10.10.0.10`) | Appsmith dark-slate executive console (Moderator review & Root authority execution) |
| **Help Desk Client Portal** | `http://localhost:5000` | Zone 1 (`10.20.0.10`) | Front-counter clerk intake portal (4-point checklist, WebCrypto SHA-256, verify/revoke desk) |
| **Verification Gateway API** | `http://localhost:3000` | Zone 3 (`10.30.0.11`) | REST API for credential issuance, verification, and revocation |
| **PQC Crypto Service** | `https://localhost:5001` | Zone 3 (`10.30.0.10`) | High-security ML-DSA-65 signing engine (internal mTLS) |
| **HashiCorp Vault KMS** | `http://localhost:8200` | Zone 3 (`10.30.0.20`) | Key management service holding post-quantum keypairs |

---

## Repository Boundaries

| Repository | Scope |
| :--- | :--- |
| **[`ScatterID`](.)** (this repository) | Core crypto service, verification API, Fabric configuration/chaincode, operations dashboard, SDK source, tools, and tests. |
| **[`ScatterID-web`](https://github.com/0x4rc4n3/ScatterID-web)** | Public product website and documentation. |

The earlier `ScatterID-app` reference has been removed because that repository is not currently available under the linked GitHub account. The website and core services have separate runtime configurations; use each repository’s own instructions rather than assuming a shared port or deployment.
---
### Automated Test Suite
```bash
# Run all unit, parity, mutation, fuzzing, ops-dashboard, and client-portal test suites:
./tests/run_all_unit_tests.sh
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
│   ├── blockchain/             # Hyperledger Fabric Network, Raft Consensus & Go Chaincode
│   └── ops-dashboard/          # Operations Console (:8080) — RBAC, Moderation, Root Approval & PQC Key Mgmt
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

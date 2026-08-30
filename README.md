# ScatterID — Post-Quantum Identity Verification Infrastructure

[![CI](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/ci.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/ci.yml)
[![CodeQL](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/codeql.yml/badge.svg)](https://github.com/0x4rc4n3/ScatterID-product/actions/workflows/codeql.yml)
[![Security: Gitleaks](https://img.shields.io/badge/Security-Gitleaks-blue.svg)](https://github.com/gitleaks/gitleaks)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

**ScatterID** is an open-source, decentralized, zero-knowledge identity verification framework. It empowers organizations to issue, anchor, and mathematically verify privacy-preserving digital credentials resilient against future quantum computer attacks.

By uniting **NIST FIPS 204 (ML-DSA-65)** post-quantum digital signatures, client-side **RFC 8785 (JCS)** canonicalization with cryptographic salting, and **Hyperledger Fabric** blockchain anchoring, ScatterID guarantees that private personal data never leaves the client device.

---

## 🌟 Key Highlights

* **🛡️ Post-Quantum Cryptography (NIST FIPS 204):** Uses ML-DSA-65 (formerly CRYSTALS-Dilithium3) lattice-based digital signatures to secure credentials against quantum decryption and forgery (Shor's algorithm).
* **🔒 Zero-Knowledge Privacy & Data Minimization:** Raw claim data (PII) is canonicalized locally and salted with a 16-byte CSPRNG secret. Only a one-way `SHA3-256` commitment is ever transmitted to the network. ScatterID never stores, sees, or logs raw identity data.
* **⛓️ Immutable Blockchain Anchoring:** Proof commitments and revocation states are permanently anchored to a permissioned Hyperledger Fabric ledger with Raft consensus.
* **🔌 Standalone Offline Verification ("Don't Trust, Verify"):** Verifiers and auditors can validate credentials air-gapped without internet access or blockchain connections using zero-dependency CLI tools.
* **⚡ One-Command Turnkey Deployment:** Full microservice stack (Vault KMS, PQC Crypto Microservice, Verification Gateway, Fabric Consortium, and Web Operator Console) launches out of the box with zero manual configuration.

---

## 🚀 Quickstart (Zero-to-Running in 60 Seconds)

ScatterID runs on any Linux or macOS machine with **Docker** and **Docker Compose** installed.

```bash
# 1. Clone the repository
git clone https://github.com/0x4rc4n3/ScatterID-product.git
cd ScatterID-product

# 2. Launch the turnkey stack (auto-provisions random keys, mTLS certs, blockchain, and containers)
./scripts/quickstart.sh

# Option: Start with the Web Operator Dashboard enabled:
./scripts/quickstart.sh --with-dashboard
```

### ⚙️ Run Modes
* **Core Backend Only (`./scripts/start.sh` or `docker compose up -d`):**  
  Starts strictly the essential headless services (PQC Crypto Engine, Verification Gateway API, Hyperledger Fabric ledger, HashiCorp Vault). Ideal for production microservice architectures.
* **Full Stack with Dashboard (`./scripts/start.sh --with-dashboard` or `docker compose --profile dashboard up -d`):**  
  Starts the core backend plus the web-based Operator Diagnostics Console on port `4000`.

---

### Active Endpoints Once Started:
| Service | Endpoint | Description |
| :--- | :--- | :--- |
| **Verification Gateway API** | `http://localhost:3000` | REST API for credential issuance, verification, and revocation |
| **PQC Crypto Service** | `https://localhost:5001` | High-security ML-DSA-65 signing engine (internal mTLS) |
| **HashiCorp Vault KMS** | `http://localhost:8200` | Key management service holding post-quantum keypairs |
| **Operator Dashboard** | `http://localhost:4000` | Real-time observability, ledger explorer, and key rotation UI |
| **Visual SDK Playground** | `http://localhost:5050` | Interactive browser sandbox (`cd examples/web-app && npm start`) |

---

### Verify the Stack with the Built-in Test Suite:
```bash
./scripts/test_all.sh
```

---

## 🎮 Interactive Visual Playground

ScatterID includes a pre-built interactive browser application to explore credential issuance and verification in real time:

```bash
cd examples/web-app
npm install
npm start
# Open http://localhost:5050 in your browser
```

* **10 Industry Presets:** Test realistic credentials across Medicine, Aviation, Cyber Defense, FinTech, and KYC.
* **Live Cryptographic Telemetry:** Inspect raw JSON canonicalization (RFC 8785), salt generation, SHA3-256 hashing, and ML-DSA-65 signatures.
* **1-Click Tamper Simulation:** Modify a single character in the claim and watch the verification engine instantly detect and reject the tamper attempt.
* **Credential Lifecycle:** Experience live credential revocation and status tracking on the blockchain.

---

## 🛡️ Standalone Offline Verification

Third-party auditors, border authorities, or offline verifiers can mathematically validate any issued credential **100% offline** without any internet connection, API keys, or blockchain dependencies:

```bash
# Node.js Verifier (zero external dependencies)
node tools/verify_offline.js <path-to-credential.json>

# Python Verifier (pure standard library math, zero dependencies)
python3 tools/verify_offline.py <path-to-credential.json>
```

Cross-language parity is asserted across both verifiers via `./tests/offline_verify_parity.test.sh`.

---

## 🏛 Architecture & Technical Documentation

For detailed architectural flowcharts, sequence diagrams, cryptographic proofs, and deployment specifications, explore the dedicated documentation guides:

* 📐 **[Comprehensive Architecture Overview & Diagrams](docs/architecture-overview.md)** — Interactive Mermaid flowcharts covering system topology, zero-knowledge issuance sequences, dual-mode verification protocols, and KMS memory zeroization.
* 📚 **[Master Documentation Index](docs/README.md)** — Complete catalog of technical specs, cryptography models, DevOps runbooks, security engineering, and compliance analysis.
* ⚙️ **[Configuration Reference (.env.example)](.env.example)** — Master environment variable template and port settings.

---

## 📁 Repository Structure

```
ScatterID/
├── components/
│   ├── crypto/                 # PQC Engine & ML-DSA-65 Signer (Python / liboqs / mTLS)
│   ├── verification-api/       # Verification Gateway API, SQLite Models & Reconciliation
│   ├── project-dashboard/      # Web Operator Diagnostics Console & Audit Viewer
│   └── blockchain/             # Hyperledger Fabric Network, Raft Consensus & Go Chaincode
├── sdk/                        # Client SDK (@scatterid/sdk for TypeScript / JavaScript)
├── examples/                   # Visual Web Playground & Integration Demos
├── docs/                       # Master Architecture, Cryptography & Compliance Specifications
├── scripts/                    # Turnkey Provisioning, Startup, & E2E Test Automation
├── tools/                      # Standalone Cross-Language Offline Verifiers (JS & Python)
├── tests/                      # Integration & Cross-Language Parity Test Suites
├── docker-compose.yml          # Container Topology Orchestration (with profile support)
├── .env.example                # Authoritative Configuration Template
├── CHANGELOG.md                # Milestone & Release History
├── SECURITY.md                 # Security Policy & Vulnerability Reporting
├── CONTRIBUTING.md             # Developer Contribution Guidelines
├── LICENSE                     # PolyForm Noncommercial License 1.0.0
└── README.md                   # Master Project Overview
```

---

## 📬 Contact & Security Reporting

For general questions, product inquiries, research collaboration, or responsible vulnerability disclosures:

* **Contact & Security Lead:** Mudassir Javed
* **Email:** [mudassirbhatti276@gmail.com](mailto:mudassirbhatti276@gmail.com)
* **Security Policy:** See [SECURITY.md](SECURITY.md) for our responsible disclosure process and vulnerability response commitments.

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

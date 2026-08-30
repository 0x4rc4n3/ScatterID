# ScatterID Documentation Library

Welcome to the comprehensive documentation library for **ScatterID** — a post-quantum, zero-knowledge identity verification infrastructure leveraging NIST FIPS 204 (ML-DSA-65), RFC 8785 JSON canonicalization, and Hyperledger Fabric.

---

## 🗺️ Master Documentation Index

```mermaid
graph TD
    A[ScatterID Documentation Index] --> B[1. Start Here]
    A --> C[2. Architecture & Cryptography]
    A --> D[3. Operations & Deployment]
    A --> E[4. Security & QA]
    A --> F[5. Compliance & Integration]

    B --> B1[Setup & Usage Guide]
    B --> B2[Architecture Overview]
    
    C --> C1[01 Strategy & Product]
    C --> C2[02 Architecture & Technical Design]
    C --> C3[03 Cryptography Specification]
    
    D --> D1[Docker Compose Runbook]
    D --> D2[Dependencies & Tooling]
    D --> D3[05 CI/CD & DevOps]
    
    E --> E1[06 Security Engineering]
    E --> E2[07 Testing & QA]
    E --> E3[Root Security Policy]
    
    F --> F1[04 Development Process]
    F --> F2[08 Compliance & Legal]
    F --> F3[09 Customer Documentation]
```

---

### 1. 🚀 Start Here
Essential guides for getting started, running the stack locally, and understanding the core value proposition:
* **[Setup and Usage Guide](SETUP_AND_USAGE.md)** — Step-by-step local provisioning, container orchestration, environment configuration, and verification.
* **[High-Level Architecture Overview](architecture-overview.md)** — Executive architectural diagram, microservice topologies, and sequence flows.
* **[01. Strategy & Product Specification](01-strategy-and-product.md)** — Problem statement, market landscape, user personas, and product roadmap.

---

### 2. 🧮 Architecture & Cryptography
Deep-dive mathematical models, PQC signature schemes, and ledger anchoring:
* **[02. Architecture & Technical Design](02-architecture-and-technical-design.md)** — Microservice specifications (Crypto Service, Verification API, Vault KMS, Hyperledger Fabric).
* **[03. Cryptography Specification](03-cryptography-specific.md)** — NIST FIPS 204 ML-DSA-65 implementation, RFC 8785 canonicalization, CSPRNG salting, and SHA3-256 commitments.
* **[Offline Mathematical Verification Tools](../tools/verify_offline.js)** — Zero-dependency standalone CLI tools for independent offline verification in [Node.js](../tools/verify_offline.js) and [Python](../tools/verify_offline.py).

---

### 3. ⚙️ Operations & Deployment
Containerization runbooks, environment configuration, and pipeline mechanics:
* **[Docker Compose Runbook](docker-compose.md)** — Multi-container topologies, profiles (backend-only vs. full dashboard), and volume bindings.
* **[Dependencies & Prerequisites](DEPENDENCIES.md)** — Detailed software requirements, system tools, Docker prerequisites, and PQC library builds.
* **[05. CI/CD & DevOps Pipeline](05-cicd-and-devops.md)** — Automated test execution, security scans (Gitleaks, CodeQL, pip-audit, npm audit), and container builds.

---

### 4. 🛡️ Security & Quality Assurance
Threat modeling, cryptographic boundaries, test suites, and audit logging:
* **[06. Security Engineering](06-security-engineering.md)** — Threat vectors, timing-safe authentication, mTLS encryption, Vault KMS hardening, and audit logging.
* **[07. Testing & Quality Assurance](07-testing-and-qa.md)** — Unit test coverage, integration tests, offline verification parity test suite, and live ledger tests.
* **[Root Security Policy](../SECURITY.md)** — Vulnerability reporting guidelines, API key tier definitions (`VERIFICATION_API_KEY`, `REVOKE_API_KEY`), and supported versions.

---

### 5. 📜 Compliance, Governance & Client Integration
Legal compliance, development guidelines, and customer onboarding:
* **[04. Development Process](04-development-process.md)** — Coding standards, git workflow, contribution guide, and release cycles.
* **[08. Compliance & Legal Framework](08-compliance-and-legal.md)** — GDPR compliance analysis, data minimization (zero raw claim storage on-chain), and jurisdictional privacy law.
* **[09. Customer Integration Guide](09-documentation-for-customers.md)** — Integration runbook for relying parties, verifiers, and enterprise credential issuers using `@scatterid/sdk`.

---

## 🔗 Quick Reference Links
* **Repository Root:** [README.md](../README.md)
* **SDK Documentation:** [sdk/README.md](../sdk/package.json)
* **Visual SDK Playground:** [examples/web-app](../examples/web-app)
* **Project Changelog:** [CHANGELOG.md](../CHANGELOG.md)
* **Open Source License (MIT):** [LICENSE](../LICENSE)

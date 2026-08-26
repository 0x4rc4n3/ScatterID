# ScatterID: Decentralized Post-Quantum Identity & Immutable Proof System

ScatterID is a post-quantum resilient, threshold-fragmented identity verification platform built as a systems-engineering project. It combines **NIST FIPS 204 ML-DSA-65 (Dilithium3)** post-quantum digital signatures with a **Shamir Secret Sharing ($k=3, n=5$)** threshold scheme over a prime field $GF(P)$, anchored immutably to a multi-node **Hyperledger Fabric** blockchain ledger.

---

## 🏛 System Architecture & End-to-End Communication Protocol

```mermaid
sequenceDiagram
    autonumber
    actor User as Operator / Web Client
    participant Dashboard as Operator Dashboard (:4000)
    participant Gateway as Verification Gateway API (:3000)
    participant Crypto as PQC Crypto Service (:5001 HTTPS)
    participant Vault as HashiCorp Vault KMS (:8200)
    participant Shards as Storage Shard Nodes 1..5 (:3001-3005)
    participant Fabric as Hyperledger Fabric (:7050 / :7051 gRPC)

    rect rgb(240, 248, 255)
    note right of User: Phase 1: Post-Quantum Signing & SSS Dispatch (POST /issue)
    User->>Dashboard: Fill claim payload & click "Issue & Anchor"
    Dashboard->>Gateway: POST /issue { claim }
    Gateway->>Crypto: POST /package { claim } (HTTPS + Bearer Auth)
    Crypto->>Vault: Query Signing Key (secret/data/pqc/signing_key)
    Vault-->>Crypto: Return Active Private Key
    Crypto->>Crypto: Sign claim payload using NIST ML-DSA-65 (Dilithium3)
    Crypto-->>Gateway: Return { signed_credential, public_key }
    Gateway->>Gateway: Split claim hash via SSS over GF(P) (k=3, n=5)
    par Distributed Shard Dispatch over scatterid_net
        Gateway->>Shards: POST /shard (Node 1) [Authorization: Bearer SHARD_NODE_API_KEY]
        Gateway->>Shards: POST /shard (Node 2) [Authorization: Bearer SHARD_NODE_API_KEY]
        Gateway->>Shards: POST /shard (Node 3) [Authorization: Bearer SHARD_NODE_API_KEY]
        Gateway->>Shards: POST /shard (Node 4) [Authorization: Bearer SHARD_NODE_API_KEY]
        Gateway->>Shards: POST /shard (Node 5) [Authorization: Bearer SHARD_NODE_API_KEY]
    end
    Shards-->>Gateway: HTTP 201 Created (WRITTEN)
    Gateway->>Fabric: Invoke AnchorCredential(id, dataHash, algo, sig) (Mutual TLS gRPC)
    Fabric-->>Gateway: Return TxID (Raft Consensus Block Committed)
    Gateway-->>Dashboard: Return { status: "anchored", credentialId, dispatchReport, anchorTxId }
    Dashboard-->>User: Render Real-time Telemetry & Dispatch Matrix
    end

    rect rgb(255, 245, 238)
    note right of User: Phase 2: Threshold Fault Verification (POST /verify)
    User->>Dashboard: Input Credential ID & Click "Verify"
    Dashboard->>Gateway: POST /verify { credentialId }
    par Network Shard Collection
        Gateway->>Shards: GET /shard/:id (Node 1) [Bearer Auth]
        Gateway->>Shards: GET /shard/:id (Node 2) [Bearer Auth]
        Gateway->>Shards: GET /shard/:id (Node 3) [Bearer Auth]
        Gateway->>Shards: GET /shard/:id (Node 4) [Bearer Auth] (Offline/Fault)
        Gateway->>Shards: GET /shard/:id (Node 5) [Bearer Auth] (Offline/Fault)
    end
    Shards-->>Gateway: Return 3 Shares (Nodes 1, 2, 3)
    alt Available Shares >= 3
        Gateway->>Crypto: POST /unpackage { shares, signature }
        Crypto->>Crypto: Lagrange Interpolation over GF(P) at x=0
        Crypto->>Crypto: Verify ML-DSA-65 Signature against Public Key
        Crypto-->>Gateway: Return { valid: true, data_hash }
        Gateway->>Fabric: Query VerifyAnchor(credentialId, dataHash)
        Fabric-->>Gateway: Return { anchorStatus: "active" }
        Gateway-->>Dashboard: Return { valid: true, anchorStatus: "active" }
        Dashboard-->>User: Display Green Validated Status Badge
    else Available Shares < 3
        Gateway-->>Dashboard: Return { valid: false, reason: "Insufficient valid shares" }
        Dashboard-->>User: Display Red Error Status Badge
    end
    end

    rect rgb(245, 255, 245)
    note right of User: Phase 3: Auto-Healing Missing Shards (POST /heal-shards)
    Dashboard->>Gateway: POST /heal-shards { nodeId: 4 }
    Gateway->>Shards: GET /health (Node 4)
    Shards-->>Gateway: HTTP 200 OK
    Gateway->>Gateway: Query 3 online nodes & reconstruct share 4 via polynomial f(4)
    Gateway->>Shards: POST /shard (Node 4) [Backfill missing share]
    Shards-->>Gateway: HTTP 201 Created
    Gateway-->>Dashboard: Return { success: true, healedShares: 1 }
    end
```

---

## 🏛 Cryptographic Security Guarantees & Boundaries

### 1. Post-Quantum Signature Scheme (ML-DSA-65 / Dilithium3)
- **Standard**: NIST FIPS 204 Standard (Module-Lattice-Based Digital Signature Algorithm).
- **Hardness Basis**: Module Learning With Errors (M-LWE) and Module Short Integer Solution (M-SIS) problems.
- **Security Category**: Category 3 (equivalent to AES-192 hardness against both classical quantum search and Shor's algorithm).
- **Public Key Size**: 1,952 bytes.
- **Signature Size**: 3,309 bytes.
- **Security Property**: EUF-CMA (Existential Unforgeability under Chosen Message Attacks).

### 2. Shamir Secret Sharing over a Prime Field $GF(P)$
- **Polynomial**: $f(x) = a_0 + a_1 x + a_2 x^2 + \dots + a_{k-1} x^{k-1} \pmod{P}$ where $a_0 = S$ (Secret Claim Hash), $k = 3$, $n = 5$.
- **Field**: Implemented via [`sslib`](https://github.com/jqueiroz/python-sslib), which builds the sharing polynomial over $GF(P)$ for a prime $P$ chosen automatically based on the secret's byte length — a standard prime-field construction, not a fixed-degree Galois Field.
- **Information-Theoretic Hardness**: Possessing $k-1 = 2$ shares reveals **0 bits of information** regarding secret $S$. Possession of any $k = 3$ shares enables exact secret reconstruction via Lagrange interpolation:
  $$S = f(0) = \sum_{j=1}^{k} \ell_j(0) \cdot y_j \pmod{P}$$
  where $\ell_j(x) = \prod_{m \neq j} \frac{x - x_m}{x_j - x_m}$.

### 3. Threshold Fault Resilience & Auto-Healing
- **Fault Threshold**: The system tolerates up to $n - k = 2$ storage node failures (or offline containers) simultaneously without impacting verification capability.
- **Strict Boundary Enforcement**: If 3 or more nodes are offline ($< 3$ reachable HTTP containers), verification fails deterministically with `400 Bad Request` (`"Insufficient valid shares: 2 of 3 required"`).
- **In-Memory Auto-Healing (`POST /heal-shards`)**: Upon node container recovery, online nodes reconstruct missing secret shares via polynomial evaluation $f(\text{nodeId})$ and backfill missing SQLite records.

---

## 🔒 Inter-Service Network Security & Protocol Architecture

All microservice communications within the Docker bridge network (`scatterid_net`) strictly enforce bearer authentication, payload integrity verification, and network isolation:

1. **Bearer Token Authentication**:
   - `SHARD_NODE_API_KEY`: Every request from `verification-api` to `shard-node-1` .. `shard-node-5` must include `Authorization: Bearer <SHARD_NODE_API_KEY>`. Unauthenticated requests are rejected with `401 Unauthorized`.
   - `CRYPTO_SERVICE_API_KEY`: Every request to `crypto-service:5001` enforces TLS 1.3 encryption and Bearer Token header validation.

2. **HashiCorp Vault Key Management (KMS)**:
   - Root keys are provisioned in HashiCorp Vault KV v2 secret engine (`secret/data/pqc/signing_key`).
   - Key rotation requests (`POST /rotate`) dynamically generate new ML-DSA-65 keypairs, persist historical public keys to volume-mounted key history (`/app/data/key_history.json`), and preserve verification validity across all previously issued credentials.

---

## 📁 Repository Structure

```
ScatterID/
├── components/
│   ├── crypto/                 # PQC Engine & Shamir SSS ($GF(2^{256})$)
│   ├── verification-api/       # Core Express Verification Gateway & SSS Dispatcher
│   ├── shard-node/             # Isolated Containerized SQLite Storage Nodes (1..5)
│   ├── project-dashboard/      # Deep-Tech Operator Dashboard & Diagnostics Engine
│   └── blockchain/             # Hyperledger Fabric Go Chaincode & Mutual TLS Network
├── docs/                       # Architectural & Technical Design Specifications
├── docker-compose.yml          # Multi-Container Topology Orchestration
├── test_all.sh                 # E2E Integration & Cryptographic Hardening Test Suite
└── README.md                   # Master Architectural Documentation
```

---

## ⚡ Quick Start & Verification

### 1. Launch the Stack
```bash
docker compose up -d --build
```

### 2. Execute Complete E2E Integration Suite
```bash
./test_all.sh
```

### 3. Access Control Interfaces
- **Operator Presentation Portal**: `http://localhost:4000`
- **Verification Gateway API**: `http://localhost:3000`
- **Post-Quantum Crypto Microservice**: `https://localhost:5001`

## Security Note
**MANUAL REVIEW REQUIRED**: Any version bumps to cryptographic dependencies (`flask`, `hvac`, `sslib`, `liboqs-python`, and any `crypto` JS packages) require manual review of changelogs before upgrading. Do not use caret (`^`) or tilde (`~`) version ranges for these packages.


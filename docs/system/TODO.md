# ScatterID Engineering Master TODO & Architecture Blueprint

## 1. Core Architectural Directives & Guiding Principles

* **Product Scope:** ScatterID core engine (Backend Gateway, Crypto Microservice, Vault, 5 Isolated SQLite Shard Nodes, and Hyperledger Fabric Anchor). The management dashboard is strictly a peripheral viewing tool.
* **Cryptographic Standard:** Strict Post-Quantum Cryptography (PQC) using **ML-DSA-65** via `liboqs` for all identity credentials, verification proofs, and state auditing.
* **Security Model:** Zero Trust Architecture (ZTA) enforcing explicit input/output validation, cryptographic workload identities, and isolated container communication boundaries.

---

##  1: Core Cryptographic & Backend Implementation (PQC ML-DSA-65)

* [ ] **1.1 Flask Crypto Service (`product/crypto-service/crypto-service/`)**
* [ ] Implement ML-DSA-65 key generation, signing, and verification endpoints using `liboqs-python`.
* [ ] Integrate HashiCorp Vault KV v2 engine for secure master private key storage and retrieval.
* [ ] Bind application explicitly to host `0.0.0.0:5001` with unbuffered output and strict TLS context.


* [ ] **1.2 Verification API Gateway (`product/verification-api/`)**
* [ ] Build Express/Node.js gateway listening on `0.0.0.0:3000` with native compilation support (`better-sqlite3`).
* [ ] Implement AJV schema validation middleware on all incoming HTTP bodies to sanitize inputs.
* [ ] Implement Shamir's Secret Sharing ($k=3, n=5$) payload splitting logic.



---

##  2: Zero Trust Internal Communication & ZTA Mesh

* [ ] **2.1 Microservice Network Isolation & Policies**
* [ ] Define custom Docker user-defined networks with default-deny ingress/egress rules between containers.
* [ ] Enforce short-lived internal service bearer tokens (`X-Internal-Token`) for all inter-service HTTP/gRPC routing.


* [ ] **2.2 Strict Ingress/Egress Schema Contracts**
* [ ] **Gateway $\rightarrow$ Crypto Service:** Enforce strict JSON schemas over HTTPS with service token validation.
* [ ] **Crypto Service $\rightarrow$ Vault:** Enforce Vault AppRole authentication and strict KV path scoping (`secret/data/scatterid/mldsa`).
* [ ] **Gateway $\rightarrow$ SQLite Nodes (1–5):** Enforce parameterized SQL prepared statements to eliminate injection vectors across shard nodes.
* [ ] **Gateway $\rightarrow$ Fabric Peers:** Enforce gRPC mTLS with gateway enrollment certificates.



---

##  3: Sharded Storage & Fault-Tolerant State Synchronization

* [ ] **3.1 Multi-Database Shard Isolation (`node_1.db` through `node_5.db`)**
* [ ] Implement independent file-level SQLite isolation across 5 distinct storage volumes.
* [ ] Implement double-layer integrity validation (SHA-256 appended share checksum + SHA3-256 database share hash).


* [ ] **3.2 Ledger-Driven State Auditing & Auto-Healing Protocol**
* [ ] Build reconnection health probes that query local SQLite `max(issued_at)` timestamps.
* [ ] Implement ledger delta querying against Hyperledger Fabric (`scatterproof` chaincode) to identify missing records ($\Delta_i$) during node downtime.
* [ ] Implement automated in-memory state reconstruction via Lagrange interpolation over finite field $GF(2^{256})$ using 3 active online shares.
* [ ] Implement atomic database backfill transactions and post-sync cryptographic integrity verification.



---

## : Hyperledger Fabric Immutable Anchoring

* [ ] **4.1 Custom Chaincode & Network Setup (`product/blockchain/`)**
* [ ] Configure 2-Org Hyperledger Fabric network on `scatterid-channel`.
* [ ] Deploy `scatterproof.go` chaincode supporting `AnchorProof` and `QueryProof` functions.
* [ ] Ensure immutable hash commits ($H_{data} = \text{SHA3-256}$) for every issued credential.



---

##  5: Production Readiness

* [ ] **5.1 Container Hardening & Deployment Prep**
* [ ] Implement multi-stage Docker builds to strip out unnecessary build tools from final production images.
* [ ] Finalize `docker-compose.yml` orchestration stack with health checks, restart policies, and environment variable isolation.

# ScatterID Architecture Overview

ScatterID is a decentralized, zero-knowledge, post-quantum identity verification infrastructure. It combines NIST FIPS 204 ML-DSA-65 digital signatures, client-side RFC 8785 JSON canonicalization with CSPRNG salting, and immutable permissioned ledger anchoring via Hyperledger Fabric.

---

## 1. System Topology & Component Architecture

The following diagram illustrates the complete microservice architecture, communication protocols, network boundaries, and credential storage layers:

```mermaid
graph TB
    subgraph ClientBoundary["🏢 Issuer / Verifier Client Boundary"]
        App["Issuer / Verifier Application"]
        SDK["@scatterid/sdk<br/>(RFC 8785 Canonicalizer + SHA3-256)"]
        App --> SDK
    end

    subgraph GatewayBoundary["🌐 ScatterID Verification Gateway (Node.js)"]
        API["Verification API<br/>(:3000)"]
        ReconDaemon["Periodic Reconciliation Daemon<br/>(Auto Self-Healing)"]
        SQLite[("Durable Metadata DB<br/>(SQLite / credentials.db)")]
        
        API <--> SQLite
        ReconDaemon <--> SQLite
    end

    subgraph SecurityBoundary["🔒 Post-Quantum Cryptographic Engine (Python 3.11)"]
        CryptoService["Crypto Microservice<br/>(:5001 / mTLS)"]
        OQS["liboqs Native C Engine<br/>(NIST FIPS 204 ML-DSA-65)"]
        KMS["KMS Driver with Memory Zeroization<br/>(ctypes memset)"]
        
        CryptoService --> OQS
        CryptoService --> KMS
    end

    subgraph VaultBoundary["🛡️ HashiCorp Vault KMS"]
        Vault["Vault Server<br/>(:8200 / KV-v2 Secret Store)"]
        KMS <-->|AppRole Auth / mTLS| Vault
    end

    subgraph LedgerBoundary["⛓️ Hyperledger Fabric Consortium"]
        Orderer["Raft Orderer<br/>(orderer.scatterid.com:7050)"]
        IssuerPeer["Issuer Peer Node<br/>(peer0.issuer.scatterid.com:7051)"]
        VerifierPeer["Verifier Peer Node<br/>(peer0.verifier.scatterid.com:8051)"]
        Chaincode["ScatterProof Chaincode (Go)<br/>(AnchorProof / RevokeProof / QueryProof)"]
        
        IssuerPeer --> Chaincode
        VerifierPeer --> Chaincode
        Orderer --> IssuerPeer
        Orderer --> VerifierPeer
    end

    subgraph OperatorConsole["📊 Operator Diagnostics Console"]
        Dashboard["Project Dashboard<br/>(:4000)"]
        Dashboard -->|REST / Bearer Auth| API
        Dashboard -->|mTLS / Admin Key| CryptoService
    end

    %% Cross-boundary connections
    SDK -->|HTTPS / POST /issue, POST /verify| API
    API -->|Internal mTLS / POST /sign_hash| CryptoService
    API -->|gRPC TLS / SubmitTx| IssuerPeer
    API -->|gRPC TLS / QueryTx| VerifierPeer
    ReconDaemon -->|Query World State| VerifierPeer
```

---

## 2. Zero-Knowledge Issuance Protocol

Raw identity claims never leave the organization's backend. Only a cryptographic pre-image commitment (`dataHash`) is ever transmitted to ScatterID.

```mermaid
sequenceDiagram
    autonumber
    actor User as Credential Subject
    participant Client as Issuer Backend (@scatterid/sdk)
    participant Gateway as Verification API
    participant Crypto as Crypto Service (PQC)
    participant Vault as Vault KMS
    participant Ledger as Hyperledger Fabric

    User->>Client: Submit Raw Claim (e.g. { name: "Alice", role: "Architect" })
    Note over Client: 1. Canonicalize Claim (RFC 8785 JCS)<br/>2. Generate 16-byte CSPRNG Salt<br/>3. Compute dataHash = SHA3-256(Salt || CanonicalJSON)
    
    Client->>Gateway: POST /issue { dataHash, idempotencyKey }
    Note over Gateway: Deduplicate idempotencyKey in DB
    
    Gateway->>Crypto: POST /sign_hash { dataHash, credentialId } (mTLS)
    Crypto->>Vault: Read active private key (AppRole)
    Note over Crypto: Sign dataHash with NIST ML-DSA-65
    Crypto-->>Gateway: Return { signature, publicKeyId, algorithm: "ML-DSA-65" }
    
    Gateway->>Gateway: Save record to SQLite (status: 'pending')
    
    Gateway->>Ledger: Submit AnchorProof(credentialId, dataHash, issuerMSP)
    Note over Ledger: Verify MSP, store in World State, emit ProofAnchored event
    Ledger-->>Gateway: Transaction Committed (TxID)
    
    Gateway->>Gateway: Update SQLite status to 'anchored' & record audit log
    Gateway-->>Client: 201 Created { credentialId, dataHash, signature, publicKeyId, anchorTxId }
    
    Client-->>User: Return complete Credential Bundle (including Salt)
```

---

## 3. Dual-Mode Verification Architecture

ScatterID supports two independent modes of verification: **Online Trust-Boundary Verification** (real-time blockchain validation) and **Zero-Dependency Offline Verification** (air-gapped mathematical checking).

```mermaid
graph TD
    subgraph InputBundle["Credential Bundle Presentation"]
        Claim["Original JSON Claim"]
        Salt["16-byte Secret Salt"]
        Proof["Proof Bundle (dataHash, signature, publicKeyId, credentialId)"]
    end

    subgraph ModeSelection{"Verification Mode"}
        Online["1. Online Verification (Real-Time)"]
        Offline["2. Offline Verification (Air-Gapped)"]
    end

    Claim --> ModeSelection
    Salt --> ModeSelection
    Proof --> ModeSelection

    subgraph OnlineFlow["Online Verification Workflow"]
        On1["SDK: Compute dataHash = SHA3-256(Salt || Claim)"]
        On2["POST /verify { credentialId, dataHash }"]
        On3["Gateway queries Vault Key Registry for publicKeyId"]
        On4["Crypto Microservice verifies ML-DSA-65 signature"]
        On5["Gateway queries Fabric Ledger for active status"]
        On6["Fail-Closed Decision: Valid iff Sig Valid AND Ledger Active"]
        
        On1 --> On2 --> On3 --> On4 --> On5 --> On6
    end

    subgraph OfflineFlow["Offline Verification Workflow (tools/verify_offline.py / .js)"]
        Off1["Level 1: Recompute SHA3-256(Salt || Claim)"]
        Off2["Assert recomputed hash == dataHash (Pre-image Commitment)"]
        Off3["Level 2: Load Issuer Public Key (--public-key hex)"]
        Off4["Execute local NIST FIPS 204 ML-DSA-65 signature verification"]
        Off5["Output: Verified cryptographic integrity without internet or blockchain"]
        
        Off1 --> Off2 --> Off3 --> Off4 --> Off5
    end

    Online --> OnlineFlow
    Offline --> OfflineFlow
```

---

## 4. Key Management, Rotation & Memory Zeroization

ScatterID implements defense-in-depth key management with zero-trust key rotation and active memory zeroization:

```mermaid
flowchart LR
    subgraph Trigger["Key Rotation Trigger"]
        Admin["Admin / Cron Job"] -->|POST /api/rotate-key| CryptoService
    end

    subgraph KMSAction["Crypto Engine KMS Lifecycle"]
        NewPair["1. Generate new ML-DSA-65 Keypair (liboqs)"]
        ComputeID["2. Compute Public Key ID = SHA3-256(PubKey)[0:16]"]
        StoreVault["3. Store in Vault KV-v2 (/scatterid/mldsa)"]
        ZeroOld["4. Overwrite previous private key in memory with zeroes (ctypes memset)"]
        
        NewPair --> ComputeID --> StoreVault --> ZeroOld
    end

    subgraph VerificationIsolation["Verification Isolation"]
        OldCreds["Historical Credentials<br/>(Signed with Key A)"] -->|Resolve publicKeyId A| VerifiedA["Verified with Key A from Registry"]
        NewCreds["New Credentials<br/>(Signed with Key B)"] -->|Resolve publicKeyId B| VerifiedB["Verified with Key B from Registry"]
    end

    CryptoService --> KMSAction
    KMSAction --> VerificationIsolation
```

---

## 5. Security Guarantees & Cryptographic Boundaries

1. **Zero Data Retention Guarantee:**
   The ScatterID database and blockchain world state strictly store hashes, signatures, public key identifiers, and timestamps. Plaintext identity claims and salts never leave the client device.
2. **Post-Quantum Standard Compliance:**
   Digital signatures conform strictly to **NIST FIPS 204 ML-DSA-65** (formerly CRYSTALS-Dilithium3), providing Category 3 post-quantum security resistant to Shor's algorithm.
3. **Fail-Closed Verification Policy:**
   If the Hyperledger Fabric blockchain is unreachable, degraded, or reports a revoked state, verification **always fails closed** (`valid: false`, `anchorStatus: "ledger_unreachable"`).
4. **Authoritative Key Registry:**
   During verification, public keys are resolved exclusively by looking up the record's registered `publicKeyId` inside the secure trust store. Any attacker-supplied public keys in request payloads are strictly ignored.

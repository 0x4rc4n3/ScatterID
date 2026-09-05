# Hyperledger Fabric Ledger Infrastructure & Go Chaincode

The `blockchain` component provides decentralized, immutable state anchoring and revocation tracking for **ScatterID** credentials via a multi-organization Hyperledger Fabric v2.5 consortium network.

---

## 1. Network Topology & Architecture

The ledger is deployed using Raft crash fault-tolerant (CFT) consensus and Mutual TLS (mTLS) across all transport channels:

- **Orderer Node**: `orderer.scatterid.com:7050` (Raft Consensus, port `7050` gRPC / `7053` OSN admin).
- **Issuer Peer (Org1)**: `peer0.issuer.scatterid.com:7051` (MSP: `IssuerMSP`, port `7051` gRPC).
- **Verifier Peer (Org2)**: `peer0.verifier.scatterid.com:8051` (MSP: `VerifierMSP`, port `8051` gRPC).
- **Consortium Channel**: `scatterid-channel`.
- **Chaincode Package**: `scatterproof` (Implemented in Go using `fabric-contract-api-go`).

```
+--------------------------+                         +--------------------------+
|        Issuer MSP        |                         |       Verifier MSP       |
|  (Verification Gateway)  |                         |  (Verification Gateway)  |
+-------------+------------+                         +-------------+------------+
              |                                                    |
              | mTLS / gRPC                                        | mTLS / gRPC
              v                                                    v
+--------------------------+                         +--------------------------+
|  peer0.issuer (Org1)     | <=====================> |  peer0.verifier (Org2)   |
|  [:7051] scatterproof CC |      Gossip Protocol    |  [:8051] scatterproof CC |
+-------------+------------+                         +-------------+------------+
              \                                                   /
               \                                                 /
                \                                               /
                 v                                             v
               +-------------------------------------------------+
               |              orderer.scatterid.com              |
               |             [:7050] Raft Consensus              |
               +-------------------------------------------------+
```

---

## 2. Privacy & Ledger Storage Model

To uphold the core zero-knowledge promise (*"Share proofs. Not raw data. No PII."*), **zero raw claims or personal data ever touch the blockchain**:

- Only the **RFC 8785 canonical claim hash** (`DataHash`, SHA3-256) and public metadata are stored.
- The ledger stores zero reversible information about the credential holder or their identity attributes.

### Ledger Data Structure: `ProofRecord`
```go
type ProofRecord struct {
    CredentialID string `json:"credentialId"` // Canonicalized UUIDv4
    DataHash     string `json:"dataHash"`     // 64-char SHA3-256 hash of credential commitments
    IssuerID     string `json:"issuerId"`     // Issuing authority identifier
    Timestamp    string `json:"timestamp"`    // ISO-8601 UTC anchor timestamp
    Status       string `json:"status"`       // "ACTIVE" | "REVOKED"
}
```

---

## 3. Smart Contract Specification (`scatterproof.go`)

### `AnchorProof`
- **Signature**: `AnchorProof(ctx, credentialID, dataHash, issuerID, timestamp)`
- **Role**: Commits a new active proof record to the ledger.
- **Authorization**: Validates that the caller's certificate-backed MSP is `IssuerMSP`.
- **Integrity**: Enforces input formatting (UUIDv4, 64-char hex) and prevents re-anchoring of existing credential IDs.

### `QueryProof`
- **Signature**: `QueryProof(ctx, credentialID)`
- **Role**: Reads the current ledger state for a credential ID.
- **Access**: Open to authenticated channel participants (`IssuerMSP` and `VerifierMSP`).

### `RevokeProof`
- **Signature**: `RevokeProof(ctx, credentialID, requestingIssuerID)`
- **Role**: Transitions proof status from `ACTIVE` to `REVOKED`.
- **Authorization**:
  1. **MSP Level**: Confirms caller identity is derived from `IssuerMSP` via `ctx.GetClientIdentity().GetMSPID()`.
  2. **Record Level**: Strictly verifies that `requestingIssuerID` matches `record.IssuerID`. Non-issuing entities or mismatching callers receive HTTP/gRPC authorization rejections.
- **Guards**: Rejects double-revocation if the proof is already revoked.

### `GetProofHistory`
- **Signature**: `GetProofHistory(ctx, credentialID)`
- **Role**: Queries Fabric's historical key modifications (`ctx.GetStub().GetHistoryForKey`), returning the immutable chronological lifecycle (`txId`, `timestamp`, `isDelete`, `record`).

---

## 4. Input Normalization & Defense-in-Depth

- **Input Case Normalization**: `credentialID` and `dataHash` strings are normalized with `strings.ToLower(strings.TrimSpace(...))` before ledger key lookups and state mutations, eliminating key fragmentation caused by mixed-case inputs.
- **Dynamic Packaging**: The network boot script (`fabric-network/start.sh`) detects source modifications in `chaincode/` against existing archives and re-packages automatically.

---

## 5. Automated Unit & Regression Tests

The smart contract includes a test suite implemented using Fabric's `shimtest.NewMockStub`:

```bash
# Run chaincode unit tests from chaincode source directory
cd components/blockchain/chaincode/src && go test -v ./...
```

### Coverage (14/14 tests passing)
- Proof anchoring, querying, and existence checks
- Case-insensitivity normalization on UUIDs and SHA3 hashes
- Cryptographic replay and duplicate anchor protection
- Unauthorized caller rejection across MSP and issuer identity boundaries
- Exploit regression testing: `TestRevokeProof_ExploitRegression_BypassWhenIssuerEqualsMSP`
- Historical lifecycle auditing via `GetProofHistory`
- Double-revocation guard assertions

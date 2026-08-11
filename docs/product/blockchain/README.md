# Hyperledger Fabric Ledger Infrastructure & Go Chaincode

The `blockchain` component anchors post-quantum credential state hashes immutably to a multi-organization Hyperledger Fabric network running Raft consensus and Mutual TLS.

---

## ⛓ Network Architecture

- **Orderer Node**: `orderer.scatterid.com:7050` (Raft Consensus, port `7050` gRPC / `7053` OSN admin).
- **Issuer Peer (Org1)**: `peer0.issuer.scatterid.com:7051` (port `7051` gRPC).
- **Verifier Peer (Org2)**: `peer0.verifier.scatterid.com:8051` (port `8051` gRPC).
- **Channel**: `scatterid-channel`.
- **Chaincode**: `scatterproof` (Written in Go using `fabric-contract-api-go`).

---

## 📜 Go Chaincode (`scatterproof.go`)

### Data Structure: `ProofRecord`
```go
type ProofRecord struct {
    CredentialID string `json:"credentialId"`
    DataHash     string `json:"dataHash"`
    IssuerID     string `json:"issuerId"`
    Timestamp    string `json:"timestamp"`
    Status       string `json:"status"` // "active" | "revoked"
}
```

### Key Invocation Methods
- `AnchorProof(ctx, credentialID, dataHash, issuerID, timestamp)`: Writes new `ProofRecord` state with `Status="active"`. Enforces client identity MSP verification.
- `QueryProof(ctx, credentialID)`: Evaluates and returns stored `ProofRecord` JSON.
- `RevokeProof(ctx, credentialID, requestingIssuerID)`: Updates `ProofRecord` status to `"revoked"`. Validates that the original issuer matches the caller.
- `ProofExists(ctx, credentialID)`: Returns boolean indicating whether a proof exists.

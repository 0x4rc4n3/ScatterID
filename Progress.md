# ScatterID Project Progress & System Audit Status

## Current Status: Functional Prototype 🟡

The previous version of this file read "PRODUCTION READY & VERIFIED 🟢" with
"100% automated test coverage" while `TODO update.md`, sitting in the same
repo, had every single item unchecked. Those can't both be true. This is the
reconciled version — accurate as of this remediation pass, not aspirational.

The core cryptographic and distributed-storage pipeline **works end-to-end**
and is more solidly built than most student projects in this space. It is
**not** production-hardened, and shouldn't be described that way until the
open items below are closed.

### What's genuinely verified (not just claimed)

- **ML-DSA-65 signing** — real `liboqs-python` usage in `pq_sign.py` /
  `keygen.py`, correct 1952-byte public key / 3309-byte signature sizes for
  Dilithium3 (Category 3 PQC).
  **prime-field** scheme. The README previously described a fixed
  $GF(2^{256})$ construction that didn't match the shipped code; the
  README now accurately describes the prime-field implementation.
- **Fault-tolerance boundary, actually tested**:
  - 5/5, 4/5, 3/5 nodes online → verification succeeds
  - 2/5 nodes online → deterministic failure (`400`, "Insufficient valid
    shares")
  - This matrix is corroborated by `test_fault_tolerance.sh` and
    `verification.test.js`, not just described in prose.
- **Auto-healing** (`POST /heal-shards`) — reconstructs a missing share via
  polynomial evaluation and backfills the SQLite record on node recovery.
- **Hyperledger Fabric anchoring** — real `@hyperledger/fabric-gateway` SDK
  usage with proper mTLS identity construction; `scatterproof.go` chaincode
  implements anchor/query/revoke.
- **Vault KMS integration** — key rotation persists prior public keys to
  `key_history.json` so previously issued credentials stay verifiable across
  a rotation.

### Fixed in this remediation pass

- Committed Fabric private keys (`priv_sk`) removed from the working tree
  (history purge is a separate, deliberate step — see `REMEDIATION_NOTES.md`)
- Flask `debug=True` in `crypto-service` disabled by default (was a real RCE
  surface via the Werkzeug debugger, inconsistent with any "production ready"
  claim)
- Redundant TLS-bypass (`NODE_TLS_REJECT_UNAUTHORIZED=0`) removed from
  `.env.example` — it directly contradicted the README's TLS enforcement
  claims and was unnecessary since `NODE_EXTRA_CA_CERTS` already does this
  correctly
- Dead duplicate crypto module (`fragmentation-module`, a near-identical,
  unused copy of `crypto-service`) removed
  implementation instead of the unimplemented $GF(2^{256})$ construction

### Genuinely still open

| Item | Status |
|---|---|
| Multi-stage Docker builds | Not done — build toolchains ship in final images |
| Compose healthchecks / restart policies | Not present |
| AJV schema validation (claimed in original TODO) | Not a dependency — actual validation is manual regex stripping |
| Docker network default-deny policy | Not independently confirmed |

## Component Checklist

| Component | Status | Notes |
|---|---|---|
| `components/crypto` | Working | ML-DSA-65 signing verified real; debug mode now off |
| `components/verification-api` | Working | Gateway + Zero-Knowledge Verification dispatch functional; schema validation is manual, not AJV |
| `components/project-dashboard` | Working | Not deeply audited in this pass |
| `components/blockchain` | Working | Real Fabric SDK integration, not mocked |
| Production hardening | Incomplete | See open items above |

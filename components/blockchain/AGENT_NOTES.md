# Agent Notes — Blockchain (component/blockchain)

## [2026-09-05] — Chaincode hardening, input normalization, audit history, and unit tests
- Problem:
  1. `RevokeProof` used flawed authorization condition (`record.IssuerID != requestingIssuerID && record.IssuerID != clientMSPID`) which bypassed issuer identity checks whenever `record.IssuerID == clientMSPID`.
  2. Input validation for `credentialID` and `dataHash` was strictly case-sensitive, causing standard uppercase/mixed UUIDs or SHA3 hex hashes to fail validation or create duplicate/inconsistent state keys.
  3. Chaincode lacked a tamper-evident audit history function (`GetProofHistory`) to query transaction lifecycle and state transitions.
  4. Chaincode had zero automated unit tests.
  5. `start.sh` skipped packaging chaincode if `scatterproof.tar.gz` existed, causing deployments to ignore chaincode source edits.
  6. AI boilerplate comments were present.
- Fix:
  1. Fixed `RevokeProof` authorization: strictly verifies caller MSP is `IssuerMSP` AND caller-specified `requestingIssuerID` strictly matches `record.IssuerID`.
  2. Added lowercase string normalization (`strings.ToLower(strings.TrimSpace(...))`) for `credentialID` and `dataHash` before validation and ledger writes/queries.
  3. Added `GetProofHistory(ctx, credentialID)` leveraging Fabric's `GetHistoryForKey` iterator returning timestamped `HistoryRecord` array.
  4. Built comprehensive unit test suite in `scatterproof_test.go` with 13 tests covering anchor, normalization, replay protection, unauthorized callers, input validation, queries, revocations, and double-revocation guards.
  5. Updated `start.sh` to automatically detect when chaincode source files are newer than `scatterproof.tar.gz` and re-package dynamically.
  6. Replaced AI docstrings with concise, professional human engineering comments.
- Files touched:
  - `components/blockchain/chaincode/src/scatterproof.go`
  - `components/blockchain/chaincode/src/scatterproof_test.go`
  - `components/blockchain/fabric-network/start.sh`
  - `components/blockchain/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

# Test Suites & Verification Framework (`tests/`)

Automated testing framework, cross-language cryptographic parity tests, and unified local test runner for the **ScatterID** ecosystem.

---

## 1. Overview & Testing Philosophy

The test harness in `tests/` is designed to provide high-assurance verification of cryptographic primitives, API boundaries, and offline verifiers without requiring Docker daemon access, live blockchain networks, or cloud dependencies:

- **Offline-First Execution**: All unit and parity tests execute directly on bare-metal developer machines in air-gapped environments.
- **Cross-Language Consistency**: Guarantees that claim hashing, RFC 8785 canonicalization, and salt commitments produce bit-for-bit identical outputs across Python and JavaScript engines.
- **Post-Quantum Forgery Testing**: Exercises live ML-DSA-65 key generation, signing, positive verification, and deterministic rejection of single-byte bitflips and forged signatures.

---

## 2. Test Scripts Catalog

### 1. Cross-Language Parity Suite (`offline_verify_parity.test.sh`)
Validates that both the Node.js structural verifier (`tools/verify_offline.js`) and Python PQC verifier (`tools/verify_offline.py`) evaluate identical test vectors with matching behavioral semantics across 6 test stages:

| Stage | Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **Stage 1** | Valid unauthenticated credential | Both verifiers succeed with pre-image commitment match |
| **Stage 2** | Tampered attribute claim payload | Both verifiers reject with HTTP/exit 1 commitment mismatch |
| **Stage 3** | Corrupted 16-byte salt | Both verifiers detect salt alteration and reject verification |
| **Stage 4** | Malformed JSON syntax / missing fields | Both verifiers reject malformed schema cleanly without unhandled exceptions |
| **Stage 5** | Live ML-DSA-65 signature verification | Python Level 2 engine verifies mathematical post-quantum signature against issuer public key |
| **Stage 6** | Single-byte signature corruption / forgery | Python Level 2 engine detects signature tampering and rejects forgery |

```bash
# Run the offline verifier parity suite
bash tests/offline_verify_parity.test.sh
```

---

### 2. Unified Local Test Runner (`run_all_unit_tests.sh`)
Orchestrates discovery and execution of all decoupled component test suites across the repository in a single command:

1. **Verification Gateway API**: Node.js native test runner (`node --test` across 30 unit tests).
2. **TypeScript SDK**: Jest test suite (6 tests covering client, revocation keys, and history queries).
3. **Hyperledger Fabric Chaincode**: Go unit tests using Fabric `shimtest` (14 tests).
4. **Crypto Microservice**: Python interface and memory cleanup suite (`test_interface.py` when liboqs is present).
5. **Offline Verifiers**: Parity test stages covering Node.js and Python verifiers.

```bash
# Execute all decoupled unit tests across the entire repository
bash tests/run_all_unit_tests.sh
```

---

## 3. Coverage Summary

| Component | Test File | Framework | Tests |
| :--- | :--- | :--- | :--- |
| **Verification Gateway** | `components/verification-api/tests/*` | Node.js Test Runner | 30 passed |
| **TypeScript SDK** | `sdk/test/index.test.ts` | Jest | 6 passed |
| **Fabric Chaincode** | `components/blockchain/chaincode/src/scatterproof_test.go` | Go `testing` / `shimtest` | 14 passed |
| **Offline Parity** | `tests/offline_verify_parity.test.sh` | Bash / Node / Python | 6 stages passed |

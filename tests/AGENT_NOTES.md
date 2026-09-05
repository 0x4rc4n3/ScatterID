# Agent Notes — Test Suite (`component/tests`)

## [2026-09-05] — Offline Verifier Parity Expansion & Unified Local Test Runner
- Problem: The repository test suite only tested basic claim payload alteration, without verifying salt corruption, malformed input parsing, or ML-DSA-65 post-quantum signature verification and forgery rejection. Additionally, there was no single unified test runner to execute unit and parity tests offline across components.
- Fix:
  - Expanded `tests/offline_verify_parity.test.sh`:
    - Added Python binary detection with `oqs` fallback.
    - Added tests for salt corruption rejection across Node.js and Python.
    - Added tests for schema omissions and JSON syntax error rejection.
    - Added automated test with live ML-DSA-65 keypair generation, signature signing, positive verification, and single-byte forgery rejection.
  - Created `tests/run_all_unit_tests.sh`:
    - Single entry-point script to discover and execute unit tests across crypto-service, blockchain chaincode, verification-api, TypeScript SDK, and offline verifiers without needing Docker or network transit.
  - All 4 active unit test suites (Crypto, Verification API, TypeScript SDK, Offline Parity) passing (4/4 suites passed).
- Files touched:
  - `tests/offline_verify_parity.test.sh`
  - `tests/run_all_unit_tests.sh`
  - `tests/AGENT_NOTES.md`
- Anything deferred / follow-up needed: None. Full test parity and unified local runner complete.

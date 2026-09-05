# Agent Notes — Verification API

## [2026-09-05] — Enforce distinct REVOKE_API_KEY from VERIFICATION_API_KEY at startup
- Problem: Privilege separation collapses if REVOKE_API_KEY is identical to VERIFICATION_API_KEY, allowing issuance credentials to perform irreversible on-chain revocation.
- Fix: Added fail-fast startup check in `src/server.js` exiting with status 1 if `REVOKE_API_KEY === VERIFICATION_API_KEY`, plus added automated unit test in `tests/auth.test.js`.
- Files touched: `components/verification-api/src/server.js`, `components/verification-api/tests/auth.test.js`, `components/verification-api/AGENT_NOTES.md`
- Anything deferred / follow-up needed: Updating default fallback in root `docker-compose.yml` and `.env.example` deferred to separate `component/keymgmt` task per scope boundaries.

## [2026-09-05] — Fix local crypto path resolution, normalize hex/UUID inputs, and add history endpoint
- Problem:
  1. `defaultCryptoPath` in `src/chain/fabric.js` had a hardcoded relative path miscount (`../../blockchain` instead of `../../../blockchain`), causing non-containerized local execution and tests to fail finding peer crypto materials (functional directory navigation defect, not an attacker-controlled path traversal / CWE-22).
  2. Input routes did not normalize UUIDs and hex hashes to lowercase, risking inconsistent SQLite queries or split keys.
  3. Lacks an endpoint to query on-chain history/audit trail from the new `GetProofHistory` chaincode method.
  4. AI boilerplate comments were present in route handlers.
- Fix:
  1. Fixed `defaultCryptoPath` in `src/chain/fabric.js` to correctly navigate 3 levels up to `components/blockchain/fabric-network/organizations/...`.
  2. Added `getProofHistory` export in `src/chain/fabric.js` and registered authenticated endpoint `GET /credentials/:credentialId/history` in `src/server.js`.
  3. Added lowercase string normalization on all UUID and hex hash inputs across `src/routes/issue.js`, `src/routes/revoke.js`, `src/routes/status.js`, and `src/routes/verify.js`.
  4. Added automated tests for case normalization and history endpoint authentication in `tests/auth.test.js` and `tests/verification.test.js` (30/30 tests pass).
  5. Replaced repetitive AI docstrings with concise, professional developer comments.
- Files touched:
  - `components/verification-api/src/chain/fabric.js`
  - `components/verification-api/src/routes/issue.js`
  - `components/verification-api/src/routes/revoke.js`
  - `components/verification-api/src/routes/status.js`
  - `components/verification-api/src/routes/verify.js`
  - `components/verification-api/src/server.js`
  - `components/verification-api/tests/auth.test.js`
  - `components/verification-api/tests/verification.test.js`
  - `components/verification-api/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

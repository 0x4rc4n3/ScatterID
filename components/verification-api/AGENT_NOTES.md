# Agent Notes — Verification API

## [2026-09-05] — Enforce distinct REVOKE_API_KEY from VERIFICATION_API_KEY at startup
- Problem: Privilege separation collapses if REVOKE_API_KEY is identical to VERIFICATION_API_KEY, allowing issuance credentials to perform irreversible on-chain revocation.
- Fix: Added fail-fast startup check in `src/server.js` exiting with status 1 if `REVOKE_API_KEY === VERIFICATION_API_KEY`, plus added automated unit test in `tests/auth.test.js`.
- Files touched: `components/verification-api/src/server.js`, `components/verification-api/tests/auth.test.js`, `components/verification-api/AGENT_NOTES.md`
- Anything deferred / follow-up needed: Updating default fallback in root `docker-compose.yml` and `.env.example` deferred to separate `component/keymgmt` task per scope boundaries.

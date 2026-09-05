# Agent Notes — SDK & Tools (component/sdk-cli)

## [2026-09-05] — Offline Verifier Security & Parity Hardening
- Problem 1: Offline verifiers displayed green checkmark indicating successful verification even when no digital signature was supplied or verified, misleading relying parties into treating unauthenticated claims as authentic.
- Problem 2: In `tools/verify_offline.js`, supplying `--public-key` resulted in a false positive assertion that the ML-DSA-65 signature was authentic, despite Node.js not executing any post-quantum signature verification algorithm.
- Fix:
  - Updated `tools/verify_offline.py` and `tools/verify_offline.js` to output yellow warning badge `⚠ VERIFICATION RESULT: PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED)`.
  - Added explicit warnings that pre-image commitment alone does not prove issuer authority.
  - In `tools/verify_offline.js`, added structural validation of the public key (1952 bytes) and signature container (3309 bytes), while clearly directing relying parties to `python3 tools/verify_offline.py` with liboqs for full mathematical PQC verification.
  - Added offline revocation freshness disclaimer across both verifiers.
- Verification: Cross-language parity test suite `tests/offline_verify_parity.test.sh` passing (both valid fixtures and tampered payloads rejected).
- Files touched: `tools/verify_offline.py`, `tools/verify_offline.js`, `tools/AGENT_NOTES.md`
- Anything deferred / follow-up needed: Documenting offline revocation freshness limitation in root `README.md` deferred to documentation/root task per scope boundaries.

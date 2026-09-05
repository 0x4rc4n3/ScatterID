# Agent Notes — SDK & Tools (component/sdk-cli)

## [2026-09-05] — Distinguish unauthenticated commitment from verified signature
- Problem: Offline verifiers displayed green checkmark indicating successful verification even when no digital signature was supplied or verified, misleading relying parties into treating unauthenticated claims as authentic.
- Fix: Updated `tools/verify_offline.py` and `tools/verify_offline.js` to output yellow warning badge `⚠ VERIFICATION RESULT: PRE-IMAGE COMMITMENT MATCH (UNAUTHENTICATED)`, added notice about unauthenticated claims, and added offline revocation freshness disclaimer.
- Files touched: `tools/verify_offline.py`, `tools/verify_offline.js`, `tools/AGENT_NOTES.md`
- Anything deferred / follow-up needed: Documenting offline revocation freshness limitation in root `README.md` deferred to documentation/root task per scope boundaries.

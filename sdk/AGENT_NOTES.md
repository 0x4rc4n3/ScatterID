# Agent Notes — TypeScript SDK (sdk/)

## [2026-09-05] — Hardening Revocation Authorization & Exposing Ledger Provenance
- Problem 1: `ScatterIDClientOptions` lacked support for `revokeApiKey`. When the verification API enforces privilege separation (`REVOKE_API_KEY != VERIFICATION_API_KEY`), revocation requests failed with 403 Forbidden.
- Problem 2: `ScatterIDClient` had no method to retrieve ledger provenance history, despite the smart contract `GetProofHistory` and gateway route `GET /credentials/:id/history` being exposed.
- Fix:
  - Added `revokeApiKey?: string` to `ScatterIDClientOptions`.
  - Added support for `X-Revoke-Key` and `Authorization: Bearer <revokeKey>` in `ScatterIDClient.revoke(credentialId, customRevokeKey?)`.
  - Defined and exported `ProofRecordHistoryItem` and `HistoryResponse` interfaces in `src/types.ts`.
  - Added `ScatterIDClient.getHistory(credentialId)` to retrieve the full immutable ledger provenance record from the gateway.
  - Added comprehensive unit tests in `test/index.test.ts` covering dedicated revocation keys, per-call key overrides, and history queries (6/6 tests passing).
  - Cleaned build generated artifacts via `tsup` (CJS, ESM, DTS).
- Files touched:
  - `sdk/src/types.ts`
  - `sdk/src/index.ts`
  - `sdk/test/index.test.ts`
  - `sdk/AGENT_NOTES.md`

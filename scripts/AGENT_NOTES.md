# Agent Notes — Key Management (component/keymgmt)

## [2026-09-05] — Enforce secure defaults for REVOKE_API_KEY and VAULT_DEV_MODE
- Problem: `docker-compose.yml` defaulted `REVOKE_API_KEY` to `VERIFICATION_API_KEY` (collapsing privilege separation) and defaulted `VAULT_DEV_MODE` to `true` (running unencrypted Vault HTTP communication).
- Fix: Removed fallback in `docker-compose.yml` for `REVOKE_API_KEY` to require explicit distinct key, set `VAULT_DEV_MODE` default to `false`, and updated `.env.example`.
- Files touched: `docker-compose.yml`, `.env.example`, `scripts/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

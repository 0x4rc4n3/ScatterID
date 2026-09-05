# Agent Notes — Key Management (component/keymgmt)

## [2026-09-05] — Enforce secure defaults for REVOKE_API_KEY and VAULT_DEV_MODE
- Problem: `docker-compose.yml` defaulted `REVOKE_API_KEY` to `VERIFICATION_API_KEY` (collapsing privilege separation) and defaulted `VAULT_DEV_MODE` to `true` (running unencrypted Vault HTTP communication).
- Fix: Removed fallback in `docker-compose.yml` for `REVOKE_API_KEY` to require explicit distinct key, set `VAULT_DEV_MODE` default to `false`, and updated `.env.example`.
- Files touched: `docker-compose.yml`, `.env.example`, `scripts/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

## [2026-09-05] — Harden .gitignore against agent scratch, reference, and temporary files
- Problem: Risk of committing agent scratch directories, reference notes, swap files, and untracked environment secrets.
- Fix: Expanded `.gitignore` with comprehensive rules for `.gemini/`, `.claude/`, `.antigravity/`, `.agent/`, `scratch/`, `notes.txt`, `*.tmp`, `*~`, `.*.swp`, and wildcard `.env.*` with `!.env.example`.
- Files touched: `.gitignore`, `scripts/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

## [2026-09-05] — Remove decommissioned project-dashboard service and script flags
- Problem: `project-dashboard` was decommissioned in #13/#14. Compose and orchestration scripts retained dashboard service configs and startup flags.
- Fix: Removed `project-dashboard` service and volumes from `docker-compose.yml`. Removed `--with-dashboard` flags and health probes from `scripts/quickstart.sh`, `scripts/start.sh`, `scripts/test_all.sh`, and `scripts/check_deps.sh`.
- Files touched: `docker-compose.yml`, `scripts/quickstart.sh`, `scripts/start.sh`, `scripts/test_all.sh`, `scripts/check_deps.sh`, `scripts/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

## [2026-09-05] — Align root README.md with decommissioned UI and offline verifiers
- Problem: Root `README.md` retained references to `--with-dashboard`, operator dashboard port 4000, and omitted capabilities and limitations of offline verifiers.
- Fix: Removed dashboard and playground references from `README.md`, updated repository directory tree, and added clear breakdown of Node.js vs. Python offline verifier capabilities and offline revocation freshness limitations.
- Files touched: `README.md`, `scripts/AGENT_NOTES.md`
- Anything deferred / follow-up needed: none

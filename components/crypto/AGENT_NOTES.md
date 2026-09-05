# Agent Notes — Crypto (component/crypto)

## [2026-09-05] — Document KMS KV-v2 signing boundary and classical mTLS transport
- Problem: Security audit identified two undocumented threat boundaries: (1) ML-DSA-65 private keys retrieved from Vault KV-v2 into crypto process memory for signing rather than within a Vault Transit / HSM boundary, and (2) internal mTLS transport uses classical RSA-2048 certs subject to HNDL risks.
- Fix: Documented both threat model considerations in `kms.py` class docstrings, `app.py` cert generation logic, created `components/crypto/SECURITY_ARCHITECTURE.md`, and outlined roadmap transitions.
- Files touched: `components/crypto/crypto-service/kms.py`, `components/crypto/crypto-service/app.py`, `components/crypto/SECURITY_ARCHITECTURE.md`, `components/crypto/AGENT_NOTES.md`
- Anything deferred / follow-up needed: Hardware HSM or Vault Transit engine migration for PQC signing in a future enterprise hardening milestone.

# ==============================================================================
# ScatterID — Least-Privilege HashiCorp Vault Policy for Crypto Service
# ==============================================================================
# This policy grants minimal required permissions for ML-DSA-65 post-quantum
# key management and isolated Transit engine signing.
# Ambient root/admin capabilities are strictly denied.
# ==============================================================================

# 1. KV-v2 Engine: Secret metadata and versions for ML-DSA-65 key material
path "secret/data/scatterid/mldsa" {
  capabilities = ["create", "read", "update"]
}

path "secret/metadata/scatterid/mldsa" {
  capabilities = ["read", "list"]
}

# 2. Vault Transit Engine: Isolated Post-Quantum Cryptographic Boundary
# Allows signing digests, verifying signatures, and reading public key info.
# Raw private key material cannot be exported or read via this endpoint.
path "transit/keys/scatterid-*" {
  capabilities = ["read"]
}

path "transit/sign/scatterid-*" {
  capabilities = ["update"]
}

path "transit/verify/scatterid-*" {
  capabilities = ["update"]
}

# 3. Token Self-Service: Allow AppRole token renewal and inspection
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

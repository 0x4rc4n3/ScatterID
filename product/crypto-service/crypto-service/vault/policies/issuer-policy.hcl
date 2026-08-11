# ScatterID Vault Policy for ML-DSA-65 KMS Client
# Enforces Least Privilege access patterns

# Read and write access to the KMS ML-DSA secret payload
path "secret/data/scatterid/mldsa" {
  capabilities = ["create", "read", "update"]
}

# Metadata read access required for KMS key history synchronization
path "secret/metadata/scatterid/mldsa" {
  capabilities = ["read"]
}

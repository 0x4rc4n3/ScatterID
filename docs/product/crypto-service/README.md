# Post-Quantum Cryptography & Shamir Secret Sharing Engine

The `crypto` component provides post-quantum digital signature packaging and Galois Field Shamir Secret Sharing fragmentation.

---

## 🧮 Cryptographic Subsystems

### 1. Post-Quantum Signing (`crypto-service`)
- **Algorithm**: NIST FIPS 204 ML-DSA-65 (Dilithium3).
- **Hardness Basis**: Module Learning With Errors (M-LWE) and Module Short Integer Solution (M-SIS) problems.
- **TLS Protocol**: Enforces HTTPS TLS 1.3 with self-signed certificate validation.
- **KMS Secrets Engine**: Integrated with HashiCorp Vault (`http://vault.scatterid.com:8200`) for KV v2 key rotation and persistent key history tracking (`/app/data/key_history.json`).

### 2. Shamir Secret Sharing (`fragmentation-module`)
- **Galois Field**: $GF(2^{256})$ with primitive polynomial $P(x) = x^{256} + x^{10} + x^5 + x^2 + 1$.
- **Threshold Scheme**: $k = 3$ required shares out of $n = 5$ total shares.
- **Polynomial Evaluation**:
  - `split_secret(data_hash, k=3, n=5)`: Evaluates $f(x)$ over $GF(2^{256})$ for $x \in \{1, 2, 3, 4, 5\}$.
  - `reconstruct_secret(shares_subset)`: Evaluates Lagrange basis polynomials at $x = 0$.

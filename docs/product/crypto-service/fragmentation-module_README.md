# Fragmentation & Post-Quantum Cryptography Module

The `fragmentation-module` is a pure Python cryptographic library providing ML-DSA-65 post-quantum digital signatures, Shamir secret splitting over Galois fields, and per-share checksum validation routines.

---

## 1. Mathematical Architecture & Cryptography

### Post-Quantum Signature Scheme (ML-DSA-65)
- Implemented via `liboqs-python` bindings for `liboqs`.
- **Algorithm**: ML-DSA-65 (NIST FIPS 204 standardized lattice-based digital signature scheme derived from Dilithium).
- **Public Key Size**: 1,952 bytes.
- **Private Key Size**: 4,032 bytes.
- **Signature Size**: 3,309 bytes.

### Shamir Secret Sharing Scheme ($k$-of-$n$)
- Implemented via `sslib` using prime field arithmetic.
- **Default Parameters**: Threshold $k=3$, Total shares $n=5$.
- **Integrity Layer**: Appends a SHA-256 integrity checksum to each share payload string formatted as `<index>-<hex_value>:<sha256_checksum>`.
- **Properties**: Information-theoretically secure; any subset of $<k$ shares reveals zero mathematical information regarding the secret.

---

## 2. Function Specifications

### `package_credential(claim_dict, private_key_bytes)`
1. Serializes `claim_dict` into deterministic canonical JSON bytes.
2. Computes `data_hash = sha3_256(canonical_bytes).hexdigest()`.
3. Computes `signature = ml_dsa_65_sign(data_hash, private_key_bytes)`.
4. Encodes `(data_hash + signature)` payload into Shamir $3$-of-$5$ secret shares.
5. Appends per-share SHA-256 checksums to each share string.

### `unpackage_credential(credential_dict, public_key_bytes, shares_subset)`
1. Validates length of `shares_subset` ($\ge 3$).
2. Validates SHA-256 checksum for each share in `shares_subset`.
3. Reconstructs combined payload via Shamir interpolation.
4. Splits payload into `data_hash` and `signature`.
5. Verifies ML-DSA-65 `signature` over `data_hash` using `public_key_bytes`.
6. Returns `(recovered_data_bytes, is_valid_boolean)`.

---

## 3. Unit Testing Pipeline

Execute full suite of Pytest unit tests verifying round-trip issuance, insufficient share rejection, and signature tampering detection:

```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r ../crypto-service/requirements.txt pytest

# Execute unit test suite
PYTHONPATH=src pytest tests/ -v
```

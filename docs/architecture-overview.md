# ScatterID Architecture Overview

## Zero-Knowledge Post-Quantum Architecture
ScatterID implements a decentralized, zero-knowledge, post-quantum identity verification system. It leverages NIST FIPS 204 ML-DSA-65 signatures, a client-side RFC 8785 canonicalization and hashing process with CSPRNG salts, and immutable ledger anchoring via Hyperledger Fabric.

## 1. Zero-Knowledge Hashing Model
Unlike traditional systems that transmit raw claims, the ScatterID SDK guarantees that claim data never leaves the organization's backend. 
- The client SDK canonicalizes the JSON claim using RFC 8785.
- The SDK generates a 16-byte cryptographically secure random salt.
- A `dataHash` is computed locally via SHA3-256(salt || canonicalizedClaim).
- Only the `dataHash` and an `idempotencyKey` are transmitted to the ScatterID issuance API.

## 2. Secure Issuance Protocol
The `POST /issue` endpoint receives the `dataHash` and deduplicates requests using the `idempotencyKey`. 
- The verification-api proxies the `dataHash` to the secure, isolated `crypto-service`.
- `crypto-service` signs the hash using the active ML-DSA-65 private key sourced from HashiCorp Vault.
- `crypto-service` assigns a `publicKeyId` indicating which public key was used for the signature.
- The signed hash is subsequently anchored to the Hyperledger Fabric blockchain.
- The ScatterID database strictly retains the UUID, `dataHash`, signature, `publicKeyId`, algorithm, and ledger anchor info. It explicitly NEVER stores raw claim data, salts, or reconstructable fragments.

## 3. Trust-Boundary Verification Protocol
The `POST /verify` endpoint ensures true cryptographic security without trusting caller inputs.
- The client SDK transmits only the `dataHash` and `credentialId`.
- Verification logic resolves the issuer's public key exclusively from ScatterID's internal trusted key registry, completely ignoring any `public_key` values provided by potential attackers in the payload.
- `crypto-service` validates the signature using the registry-resolved key.
- The Hyperledger Fabric ledger is queried to confirm the `dataHash` hasn't been tampered with and that the credential's status remains 'active' (not revoked).

## Verification & Execution Summary (Last verified: 2026-08-26)
Both test suites were executed and passed cleanly:

**SDK test suite (sdk/, 3 tests passed):**
- smoke test: constructs a client and computes a hash without import errors
- should compute consistent hash for a given claim and salt
- should deduplicate issues with the same idempotency key

**Verification-API test suite (components/verification-api/, 4 tests passed):**
- createCredential/getCredentialById: round-trip storage and retrieval.
- statusRoute: returns correct field normalization for a stored credential.
- issueRoute idempotency: two calls with the same idempotencyKey produce exactly one database row (first returns 201, second returns 200 with same credentialId).
- verifyRoute trust boundary: attacker-supplied publicKeyId/publicKey fields in the request body are ignored; the route resolves the key exclusively from the stored record's publicKeyId field.

# ScatterID — Zero-Knowledge Verification Redesign

**Purpose of this document:** This is the full technical specification for converting ScatterID from its current "threshold-fragmented-but-reconstructable" credential model into a true reconstruction-less, zero-knowledge verification system. It is intended to be read alongside the existing repository (`0x4rc4n3/ScatterID-product`) and handed to an implementing engineer or AI coding agent as the source of truth for what to build and why.

---

## 1. Why this redesign exists

The current system (`components/crypto/crypto-service/{shamir,interface}.py`) Zero-Knowledge Verification-splits the **raw claim bytes** across 5 shard nodes with a 3-of-5 threshold, and verification works by **reconstructing the original data** (`unpackage_credential()` returns `recoveredData`) and checking a signature against it. This means:

- The server-side system, in aggregate, can always reconstruct the original claim data. No single node has it, but any 3 colluding (or compromised) nodes do.
- This does not match a "the server never sees/reconstructs plaintext, even transiently" claim. It is a legitimate distributed-custody design, but it is not zero-knowledge, and should not be described as such.

The goal of this redesign: **the server (issuance layer, verification layer, database, blockchain anchor — all of it) should never receive, store, or be capable of reconstructing the original claim data at any point, ever.** All it ever sees is a hash, a signature, and metadata. The org's own backend is the only place the real claim data lives.

This is also a **credibility decision**, not just a technical one. A project asking to be trusted with identity/credential data should have the smallest, most auditable trust-critical core possible. Distributed Zero-Knowledge Verification reconstruction, checksum validation across 5 nodes, and fault-tolerance math are all interesting engineering — but they are *not* part of a minimal verification trust boundary, and every line of code in that boundary is a line an outside auditor has to read and trust. Cutting the trust-critical path down to "hash in, signature out, compare" is what makes this auditable by a stranger in an afternoon instead of a week.

---

## 2. Core architectural change

### 2.1 Old flow (current repo)

```
Org → [claim data] → crypto-service /package
                         → signs raw claim bytes
                         → Zero-Knowledge Verification-splits raw claim bytes into 5 shares
                         → shares distributed to 5 shard-node databases
Org → [credentialId]  → verification-api /verify
                         → fetches 3+ shares from shard nodes
                         → RECONSTRUCTS raw claim bytes
                         → verifies signature against reconstructed bytes
                         → returns valid/invalid
```

The server holds (in a distributed, reconstructable form) the actual claim data, indefinitely, for the life of the credential.

### 2.2 New flow (target)

```
Org's own backend (via SDK, entirely client-side):
    claim → canonicalize (RFC 8785 JCS) → generate random salt (16B CSPRNG)
    → dataHash = SHA3-256(salt || canonicalizedClaim)
    → claim + salt are NEVER transmitted to ScatterID. They stay with the org.

Org → [dataHash only] → issuance-api /issue
    → crypto-service signs dataHash with ML-DSA-65 issuer private key
    → returns { credentialId, dataHash, signature, publicKeyId, issuedAt }
    → dataHash + signature + metadata anchored on Hyperledger Fabric
    → Org's backend returns the full credential object (including salt!)
      to whoever needs to prove/verify it later (the "holder").

Verification, later, by anyone holding (claim + salt) or just (dataHash):
    Verifier → [dataHash] → verification-api /verify
    → verification-api looks up stored (dataHash, signature, publicKeyId, anchorStatus)
    → checks Fabric anchor status (not revoked)
    → verifies ML-DSA-65 signature(dataHash) against issuer's PUBLIC key
      (public key sourced ONLY from ScatterID's own trusted key registry —
       never from anything the caller submits)
    → returns { valid, anchorStatus, issuedAt }

    If the verifier only has (claim + salt) and not dataHash directly,
    the SDK recomputes dataHash = SHA3-256(salt || canonicalize(claim))
    locally, client-side, and sends only that hash. Same rule always
    applies: raw claim data never crosses the wire to ScatterID.
```

At no point does any ScatterID-operated component receive, store, or reconstruct the claim. Zero-Knowledge Verification has no role in this flow and should be removed from the trust-critical path entirely (see §6).

---

## 3. Detailed fixes and design decisions (the "tweaks")

### 3.1 Salting the hash (critical — prevents dictionary/enumeration attacks)

**Problem:** A raw `SHA3-256(canonicalize(claim))` with no salt is a *guessable commitment* if the claim space is small — e.g. `{"subject": "John Doe", "role": "Employee"}`. An attacker can enumerate plausible subject/role pairs, hash each candidate locally, and compare against the public `dataHash` stored on-chain/in your DB to learn whether a specific person holds a specific credential, without ever being authorized to know that. This is structurally identical to unsalted password hashing.

**Fix:** At issuance time, the issuer (client-side, in the org's own backend via the SDK) generates a cryptographically random salt:
```
salt = os.urandom(16)   # Python
salt = crypto.randomBytes(16)  // Node
```
The hash becomes:
```
dataHash = SHA3-256(salt || canonicalizedClaimBytes)
```
The salt is returned to the org as part of the issuance response and **must be delivered to the credential holder** alongside the claim data (it is not secret in the cryptographic sense — it just needs to be known to reproduce the hash — but it should not be published alongside the hash itself, or the anti-enumeration property is lost). Store the salt only within the org's own system / with the holder — ScatterID's backend never needs to store the salt, since it never recomputes the hash from claim data; it only ever compares an incoming hash to the one on file.

### 3.2 Canonicalization must be a real, cross-language spec (RFC 8785 JCS)

**Problem:** The current code does `json.dumps(data, sort_keys=True)` — Python-specific. The moment there's also a Node/TypeScript SDK, `JSON.stringify` with manually sorted keys will not byte-for-byte match Python's serialization in every edge case (number formatting, e.g. `1.0` vs `1`, unicode escaping, whitespace). A single mismatched byte produces a completely different hash, and verification silently fails with no useful error for the integrator.

**Fix:** Adopt **RFC 8785 (JSON Canonicalization Scheme, JCS)** as the canonicalization standard for all claim hashing, in every language SDK. Use an existing, audited JCS library per language rather than a bespoke implementation:
- Python: `python-jcs` (or equivalent audited package)
- Node/TypeScript: `canonicalize` (npm package implementing RFC 8785)

Document this explicitly in the public spec (see §7) so any third party can independently verify that their own hash computation matches ScatterID's, without needing ScatterID's code at all.

### 3.3 Removing Zero-Knowledge Verification/shard-nodes from the trust-critical path

**Decision needed, but default recommendation: drop entirely from verification.** Two options:

- **Option A (recommended):** Remove `shamir.py`, the shard-node fleet, and all share-reconstruction logic from the issuance/verification flow entirely. ScatterID becomes a pure attestation service: sign a hash, anchor it, verify it later. Simpler, smaller trust-critical core, much easier to audit — directly serves the stated goal of building credibility through code that's small enough for a stranger to fully read.
- **Option B:** Keep Zero-Knowledge Verification/shard-nodes as a clearly separate, opt-in feature for orgs that want *their own* distributed backup of *their own* data for compliance/business-continuity reasons — but it must never be part of what a verifier depends on, and must be architecturally isolated (different service, different trust boundary, clearly labeled as "org's own data custody, not part of ScatterID's zero-knowledge verification guarantee") so it cannot be mistaken for part of the security model.

If Option B is chosen, the existing checksum-only integrity mechanism (unkeyed SHA-256 hash per share) still needs the fix noted in the original pentest (upgrade to a keyed MAC) — but that's now scoped to an optional backup feature, not the core trust path.

### 3.4 Public key trust boundary (carried over from the original pentest — still applies)

Regardless of the above, `unpackage_credential()`'s current bug — trusting a `public_key` field embedded in the object being verified — must not exist in the new design either. In the new flow, `/verify` must resolve the issuer's public key **only** from ScatterID's own trusted key registry (keyed by `publicKeyId`, itself set only at issuance time by ScatterID's own crypto-service, never by caller input), never from anything present in the request body.

### 3.5 SDK method surface (updated for the zero-knowledge model)

```
client.issue(claim: object) → { credentialId, dataHash, salt, signature, publicKeyId, issuedAt }
    // claim is hashed+salted LOCALLY inside the SDK.
    // Only dataHash ever leaves the process boundary over the network.
    // salt + credentialId must be safely returned to/stored by the org calling issue().

client.verifyByClaim(claim: object, salt: string, credentialId?: string) → { valid, anchorStatus, issuedAt, reason? }
    // SDK recomputes dataHash locally from claim+salt, sends only the hash (+ credentialId if known).

client.verifyByHash(dataHash: string, credentialId?: string) → { valid, anchorStatus, issuedAt, reason? }
    // For verifiers who only ever received a hash, not the raw claim.

client.getStatus(credentialId: string) → { status, anchorTxId, issuedAt }
```

No signing key, no share material, no crypto primitives are ever exposed to or required from the SDK consumer. The SDK's entire cryptographic responsibility client-side is: canonicalize → salt → hash. Nothing else.

### 3.6 Idempotency, auth, and error handling (unchanged recommendations from prior review, restated here for completeness)

- `client.issue()` must send a client-generated idempotency key; `/issue` must dedupe on it server-side, or SDK retries on timeout will double-issue.
- Per-org API keys (not one shared static token) so orgs can be individually rate-limited/revoked — required before this is handed to external third parties.
- SDK maps `{error, code}` HTTP responses to typed exceptions (`InvalidClaimError`, `CredentialNotFoundError`, `RevokedCredentialError`, `CryptoServiceUnavailableError`) rather than making integrators string-match.
- Constant-time comparison for all secret/API-key checks server-side (`hmac.compare_digest` / `crypto.timingSafeEqual`) — carried over from the original pentest, still applies to whatever auth mechanism replaces the shared static token.

### 3.7 Alignment with W3C Verifiable Credentials

Where reasonably possible, shape the `SignedCredential` object to loosely match the W3C Verifiable Credentials Data Model (issuer, credentialSubject-style claim structure, proof object containing algorithm + signature + verificationMethod pointing at the public key). This is not a hard requirement, but it means an external cryptographer can check ScatterID's format against a well-known, publicly reviewed spec instead of reverse-engineering trust in a bespoke format — directly useful for an open-source project trying to earn scrutiny-based trust rather than assert it.

---

## 4. What ScatterID's backend stores after this redesign (data inventory)

Per credential, ScatterID's database/ledger should contain **only**:
- `credentialId` (UUID)
- `dataHash` (salted hash, hex)
- `signature` (ML-DSA-65 signature over dataHash, hex)
- `publicKeyId` (pointer to issuer's public key in ScatterID's own key registry — never caller-supplied)
- `algorithm`
- `issuedAt`
- `status` / `anchorTxId` (revocation + chain-anchor bookkeeping)

Explicitly **not stored, ever**: the claim itself, the salt, anything from which the claim could be reconstructed. This inventory should be stated plainly in public-facing documentation as the actual data-retention guarantee — specific and falsifiable, not just "we value your privacy."

---

## 5. Migration notes

- This is a breaking change to the `SignedCredential` interface contract and to the crypto-service `/package` → `/unpackage` API shape. Existing credentials issued under the old (raw-data Zero-Knowledge Verification) model cannot be silently reinterpreted under the new model — they used a genuinely different cryptographic commitment (unsalted hash of raw data, plus reconstructable shares). Plan either a hard cutover with a clearly versioned `SignedCredential.version` field, or support both verification paths during a transition window, explicitly labeled by version.
- Removing shard-node from the critical path is itself a significant infrastructure simplification — plan for decommissioning or repurposing that fleet, not just leaving it running unused.

---

## 6. Summary of every change relative to the current repo

| Area | Current | New |
|---|---|---|
| What's transmitted to ScatterID at issuance | Raw claim data | Salted hash only |
| What's transmitted to ScatterID at verification | Shares → reconstructed raw data | Hash only |
| Canonicalization | `json.dumps(sort_keys=True)`, Python-only | RFC 8785 JCS, cross-language |
| Salt | None (guessable hash) | 16-byte CSPRNG salt per credential |
| Zero-Knowledge Verification/shard-nodes | Core to verification (reconstruction) | Removed from trust path (optional, isolated backup feature at most) |
| Public key trust source | Can be caller-embedded (bug) | Only ScatterID's own key registry, by `publicKeyId` |
| SDK crypto exposure | N/A (no SDK yet) | Canonicalize + salt + hash only; no keys, no shares, ever client-exposed on the verify side |
| Data ScatterID can reconstruct | Full claim (via 3-of-5 shares) | Nothing — hash is one-way, no path back to plaintext |

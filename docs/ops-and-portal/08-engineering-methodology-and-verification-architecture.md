# ScatterID — Engineering Methodology, Sub-Component Breakdown & Verification Architecture

**Document ID:** DEV-ARCH-08  
**Status:** Normative Engineering Directives  
**Companion Documents:** `01-internal-dashboard-requirements-and-access.md`, `05-README-documentation-overview.md`, `07-network-topology-and-segmentation.md`

---

## 1. Engineering Principles & Implementation Rules

When implementation begins, all development across `ScatterID` and satellite components must strictly adhere to the following execution invariants:

### 1.1 Atomic, Sub-Component Decomposition
- **No Monolithic Builds**: Never attempt to build an entire module or service in a single pass.
- **Micro-Sub-Components**: Every major component must be decomposed into isolated, testable micro-sub-components (e.g., rather than "build moderation queue", break into: (1) SQLite schema & migration, (2) atomic transaction wrapper, (3) ingestion route, (4) state transition validator, (5) audit logging hook).
- **Atomic Commits & Verification**: Each sub-component must be verified and passing its own test cases before the next layer is introduced.

### 1.2 Defensive Programming — Worst-Case Scenario Architecture
Every line of backend code must be written assuming failure, malice, or disruption:
- **Network Partitions & Mid-Flight Timeouts**: Assume the connection to the Hyperledger Fabric peer or Verification Gateway drops mid-transaction. Operations must use idempotent idempotency keys and transactional rollbacks.
- **Malformed & Adversarial Input**: Fuzzing resistance; strict boundary checks on all JSON payloads; zero trust on client-submitted timestamps or IDs.
- **State Race Conditions**: Database row-level locks / WAL mode atomic writes to prevent two moderators or a moderator and root from acting on the same request concurrently.
- **Database Corruption / Power Loss**: WAL mode with synchronous commit logging; automatic recovery on boot.
- **Key Desynchronization**: Deterministic fallback if a signing key is rotated during an in-flight signature request.

### 1.3 Backend-First & Raw HTML Test Harnesses (Zero Complex UI)
- **UI Frameworks Deferred**: Complex UI builds (Appsmith configurations, Flowbite styled bundles) are completely omitted during backend construction.
- **Plain Backend Focus**: 100% of engineering effort is directed towards secure REST/gRPC endpoints, business logic, cryptographic signing, and ledger interactions.
- **Raw HTML / Minimal Test Harnesses**: For manual verification, use zero-dependency, bare-bones plain HTML test forms (`fetch()` calls, unstyled tables, raw JSON outputs) alongside automated integration tests (`curl` / automated test suites).

### 1.4 Isolated Git Branching Strategy
- **One Branch Per Sub-Component**: Dedicated branch per atomic task (e.g., `feat/ops-schema-v2`, `feat/ops-auth-argon2`, `feat/ops-tiered-routing`).
- **No Cross-Contamination**: Branches branch from clean `main` (or designated component base) and merge only after full verification.
- **Zero Remote Push Without Approval**: All changes remain local until explicitly requested.

---

## 2. Verification Architecture: How Verification Works (Offline vs. Online)

### 2.1 The Core Distinction: What Does "Verification" Actually Check?

A ScatterID verifiable credential consists of three cryptographic tiers:

```
[ Credential Payload (Claimant Data + Salt) ]
                     │
                     ▼ RFC 8785 Canonicalization
[ SHA-256 Digest ] -----------------------------> Level 1: Data Integrity Check
                     │
                     ▼ Signed by ML-DSA-87 Private Key
[ Quantum-Safe Signature + Key ID ] -----------> Level 2: Cryptographic Authenticity Check
                     │
                     ▼ Query Ledger Status on Hyperledger Fabric
[ Revocation Status (Active vs. Revoked) ] ----> Level 3: Status / Revocation Check
```

---

### 2.2 How Offline Verification Works (Air-Gapped / Remote)

**Scenario**: An inspector at an airport boarding gate, a remote border crossing in the mountains, a field police unit, or a bank branch in a different city with **no internet, no VPN, and no access to the ScatterID server**.

#### Can they verify the credential? **YES. 100% Mathematically.**

1. **Pre-requisite**: The inspector's device (phone, laptop, scanner terminal) has the **ScatterID Public Key** (`root_pubkey.pem`) pre-installed (similar to how browsers have trusted Root CAs pre-installed, or downloaded once during device setup).
2. **Step 1 — Integrity (Level 1)**:
   - The device reads the credential JSON (via QR code, NFC, or USB file).
   - It canonicalizes the claimant attributes using RFC 8785 and computes SHA-256.
   - If the hash matches the embedded hash, **the data has not been modified by even 1 bit**.
3. **Step 2 — Mathematical Authenticity (Level 2)**:
   - The device runs the post-quantum ML-DSA-87 signature verification algorithm:
     $$\text{Verify}(\text{PublicKey}_{\text{authority}}, \text{SHA-256 Digest}, \text{Signature}) \xrightarrow{} \text{PASS / FAIL}$$
   - If it passes, it is a mathematical certainty that **only the official ScatterID Authority possessing the private key could have generated this credential**.
4. **Network Usage**: **Zero bytes. Completely air-gapped.**

---

### 2.3 The Revocation Limitation of Pure Offline Verification

- If Alice was issued a valid credential in January, and it was revoked in March (e.g. reported stolen):
- Alice's credential remains **mathematically authentic** forever. The signature does not "disappear" from the card.
- **Offline devices cannot know Alice's card was revoked yesterday UNLESS**:
  - **Method A (Daily Delta Sync)**: When the terminal has periodic connectivity (e.g., docked at night), it downloads the latest **Revocation Accumulator / CRL** (a compact list of revoked hash digests). The terminal checks credentials against this local revocation cache.
  - **Method B (Online Verification)**: The device connects via network/VPN to query the live ledger.

---

### 2.4 Why Have a "Verify Desk" on the Internal Help Desk Portal?

The user raised a sharp question:
> *"if client-portal is in different city, he connect via vpn(need internet), and let we need to verify, i mean whats the purpose to verify from internal stuff(we dont have portal for mod but its meaningless)"*

#### 1. The Real Consumers of "Verify" are External Entities
In a production deployment, the entities doing 99% of verifications are **NOT** the internal Help Desk. They are:
- **Third-Party Verifier Apps / Portals** (`ScatterID-verifier`): Mobile apps held by airport security, banks, police officers, or university registrars.
- **Partner APIs**: Financial institutions querying the verification gateway to authenticate a customer.

#### 2. So Why Does the Help Desk Have a "Verify Desk" at all?
The "Verify Desk" on the Help Desk portal is strictly an **administrative diagnostic and intake validation tool**, specifically for:
1. **In-Person Claimant Support / Counter Troubleshooting**:
   - A citizen walks up to the counter and says: *"The bank rejected my credential saying it is invalid."*
   - The clerk pastes/scans the credential into Verify Desk to run a full diagnostic:
     - Level 1: Hash mismatch? (Data was corrupted or edited by the user).
     - Level 2: Signature invalid? (Signed with an old/expired key, or forged).
     - Level 3: Revoked? (Shows revocation timestamp and reason code: *"Revoked on 2026-08-10 due to lost report"*).
2. **Renewal or Superseding Credential Intake**:
   - A claimant presents their old credential to obtain an upgrade or secondary permit. The clerk verifies the authenticity of the primary credential before creating an issuance request for the new one.
3. **Clerk Sanity Check Before Submitting Revocation**:
   - Before submitting a revocation request, the clerk verifies the credential ID to ensure they are targeting the correct active credential, avoiding accidental revocations of wrong accounts.

#### 3. Why Internal Dashboard (Mod/Root) Does NOT Need a Standalone "Verify Portal"
- The user is completely correct: **A dedicated Verify tab on the Mod/Root dashboard would be redundant.**
- Mod and Root are operators reviewing audit logs, queues, and ledger health. They do not intake citizens at a counter.
- For Mod/Root, verification is embedded **in-line** directly inside the Moderation Queue: when Mod looks at a pending request, the system displays the Level-1/Level-2 validity badge right on the review card. Mod never needs a separate manual verify playground.

---

## 3. Summary of Verification Roles & Modes

| Verifier Type | Location & Connectivity | What it Checks | Why it's Used |
|---|---|---|---|
| **External Verifier App (`ScatterID-verifier`)** | External world / Airports / Banks / Mobile (Offline or Public Net) | Level 1 (Hash) + Level 2 (PQC Signature) [+ Level 3 if online] | **The Primary Use Case**: Daily real-world identity verification by relying parties. |
| **Help Desk "Verify Desk"** | Counter Terminal over Counter VPN (`10.20.0.0/24`) | Level 1 + Level 2 + Level 3 (Direct Gateway query) | **Administrative Troubleshooting**: Citizen support, renewals, intake sanity checking. |
| **Moderation Queue Review** | Internal Dashboard (`10.10.0.0/24`) | In-line automated validation | **Issuance/Revocation Audit**: In-line check before approving ledger transactions. |

---

## 4. Key Ring Storage Footprint & Offline Key Rotation Protocol

### 4.1 Storage Footprint: Is Key History Affordable on Offline Devices?

**Yes, completely affordable. The storage required is virtually zero.**

In Post-Quantum Cryptography (FIPS 204 / ML-DSA):
- **ML-DSA-44 (NIST Level 2)**: Public key = 1,312 bytes (~1.3 KB)
- **ML-DSA-65 (NIST Level 3)**: Public key = 1,952 bytes (~1.9 KB)
- **ML-DSA-87 (NIST Level 5)**: Public key = 2,592 bytes (~2.5 KB)

#### Real-World Footprint Calculation (Assuming ML-DSA-87):
| Rotation Frequency | Total Rotations | Total Storage on Device | Real-World Comparison |
|---|---|---|---|
| **1 key per year for 10 years** | 10 keys | **~26 Kilobytes** | Smaller than a single text email |
| **1 key per year for 50 years** | 50 keys | **~130 Kilobytes** | Smaller than an app icon image |
| **1 key per month for 10 years** | 120 keys | **~311 Kilobytes** | Less than 10% of a single smartphone photo (3 MB) |

Even on an inexpensive $15 embedded terminal or basic smartphone, storing decades of public keys takes less than 0.5 MB of flash storage.

---

### 4.2 How the Offline Device Matches Keys (`key_id` Keyring)

The verifier maintains a local lightweight JSON/SQLite table called the **Authority Keyring**:

```json
[
  {
    "key_id": "pqc-mldsa87-2024-v1",
    "status": "retired",
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_until": "2024-12-31T23:59:59Z",
    "public_key_hex": "3a8f... (2,592 bytes)"
  },
  {
    "key_id": "pqc-mldsa87-2025-v1",
    "status": "active",
    "valid_from": "2025-01-01T00:00:00Z",
    "valid_until": "2025-12-31T23:59:59Z",
    "public_key_hex": "7b1c... (2,592 bytes)"
  }
]
```

When a credential is presented:
1. The verifier inspects the credential's metadata: `"key_id": "pqc-mldsa87-2024-v1"`.
2. It fetches that specific public key from its local keyring.
3. It validates the cryptographic signature. Credentials issued under older keys remain mathematically valid for their entire lifespan.

---

### 4.3 The "Same-Day Rotation While Offline" Scenario

**The Problem**: What happens if the central authority rotates to a brand-new key (`v3`) at 9:00 AM, a citizen receives a credential signed with `v3` at 10:00 AM, and at 11:00 AM they present it to an offline inspector whose device hasn't synced since yesterday?

1. **Deterministic Device Behavior**:
   - The device searches its keyring for `key_id: "pqc-mldsa87-2026-v3"`.
   - Result: Key ID not found.
   - The device displays: **`UNKNOWN_KEY_ID: Terminal synchronization required to verify key pqc-mldsa87-2026-v3`**.
   - It does **not** declare the credential "forged" or "fraudulent" — it clearly identifies an outdated local trust store.

### 4.3 Key Distribution Architecture: Pre-Distribution & Delegation Fallback

To address the offline rotation challenge, ScatterID mandates a 2-tier distribution architecture:

#### Tier 1: Advance Pre-Distribution (Primary Architectural Standard)
- **Pre-Staged Key Pool**: The authority pre-generates future ML-DSA keys (`v2`, `v3`, `v4`) months in advance during scheduled root ceremonies.
- **Keyring Pre-Staging**: Public keys are pushed to all verifier devices during routine syncs well ahead of activation.
- **Seamless Cutover**: When a rotation occurs (whether routine or scheduled emergency), verifier devices already have the public key in their local keyring. Zero rejected credentials, zero terminal downtime.

#### Tier 2: Cryptographic Delegation Endorsements (Emergency Fallback)
- **The Catastrophic Trigger**: If an attacker compromises the server key vault and invalidates *both* the active key and all pre-staged keys, the authority must mint an entirely fresh, un-staged key (`v_emergency_fresh`).
- **Cryptographic Endorsement**: The current active key or master offline authority signs a **Delegation Endorsement Certificate** certifying that `v_emergency_fresh` is legitimate.
- **Local Chain Validation**: Offline devices verify the delegation certificate using their known trusted key, establishing trust in the new emergency key without requiring an out-of-band firmware push or network connection.


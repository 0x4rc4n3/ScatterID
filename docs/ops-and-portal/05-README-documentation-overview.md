# ScatterID — Ops & Access Documentation Suite (v2.1)

This documentation suite serves as the complete technical, operational, and architectural specification for the ScatterID Operations Dashboard, Help Desk Client Portal, Key Lifecycle Management, and Network Security Architecture.

---

## 1. Documentation Index

The specification is organized into modular, purpose-built documents:

| File | Category | Focus / Scope |
|---|---|---|
| [`start.md`](start.md) | **Execution** | **Master Execution Blueprint & Auto-Start Guide** |
| [`01-internal-dashboard-requirements-and-access.md`](01-internal-dashboard-requirements-and-access.md) | Ops Dashboard | Requirements, Mod/Root separation, Scenario B Tiered Risk, MFA, dual-key rotation |
| [`02-internal-dashboard-ui-ux-design.md`](02-internal-dashboard-ui-ux-design.md) | Ops Dashboard | Layout design, auto-execution cues, MFA setup, backup & restore UI |
| [`03-client-portal-requirements-and-access.md`](03-client-portal-requirements-and-access.md) | Client Portal | Help Desk operational requirements, Counter VPN access, clerk audit attribution |
| [`04-client-portal-ui-ux-design.md`](04-client-portal-ui-ux-design.md) | Client Portal | Flowbite UI layout, physical inspection checklist, direct verification console |
| [`05-README-documentation-overview.md`](05-README-documentation-overview.md) | Overview | Master system overview, routing flow, and role matrix |
| [`06-disaster-recovery-and-key-lifecycle.md`](06-disaster-recovery-and-key-lifecycle.md) | Security & Ops | MFA device migration, recovery codes, break-glass CLI, dual-key rotation, PQC backups |
| [`07-network-topology-and-segmentation.md`](07-network-topology-and-segmentation.md) | Infrastructure | 3-zone network topology, iptables firewall micro-segmentation, WireGuard VPN configuration |
| [`08-engineering-methodology-and-verification-architecture.md`](08-engineering-methodology-and-verification-architecture.md) | Engineering & Dev | Atomic sub-component breakdown, defensive worst-case coding, zero-UI raw testing, offline/online verification architecture |
| [`verification-channel-and-escalation-addendum.md`](verification-channel-and-escalation-addendum.md) | Core Domain | Baseline Hard vs. Soft channel definitions and evidentiary standards |

---

## 2. The System in One Paragraph

A credential request (issue or revoke) originates at the **Help Desk Portal**, operating over an encrypted, micro-segmented **Counter VPN (`10.20.0.0/24`)**. An authenticated clerk inspects claimant credentials, records the **Verification Channel** (Hard: physical in-person inspection; Soft: digital scan upload), and submits the request with an immutable **Audit Attribution Stamp** (`staff_user_id`, `station_id`, `channel`, `timestamp`). The request routes to the **Internal Ops Dashboard (`10.10.0.0/24`)** where a **Moderator (Mod)** performs review. Under **Scenario B: Tiered Risk**, if a Hard-Channel issuance request is explicitly approved by Mod, it **auto-executes directly on Hyperledger Fabric** with zero delay; if Soft-Channel, or if flagged, it routes to the **Root Administrator** for final approval. All Revocations and PQC Key Rotations strictly require Root authorization and execution. Network firewalls isolate the Counter VPN so clerks can never access the Internal Dashboard (`:8080`) or backend databases. Authentication is protected by Argon2id and TOTP MFA, with zero-downtime dual-key rotation, self-service phone migration, and an offline break-glass CLI (`tools/admin_cli.js`) to guarantee disaster recovery.

---

## 3. Operational Routing Matrix (Scenario B: Tiered Risk)

| Action Type | Verification Channel | Mod Action | System Execution Behavior |
|---|---|---|---|
| **Issuance** | **Hard Channel** (Physical) | **Approve** | ⚡ **AUTO-EXECUTES on Hyperledger Fabric immediately** (Stamps Mod ID + Clerk ID) |
| **Issuance** | **Hard Channel** (Physical) | **Flag** | Routes to Root Queue as `FLAGGED` (Root decides execution) |
| **Issuance** | **Soft Channel** (Digital Scan) | **Approve** | Routes to Root Queue as `AWAITING_ROOT_ACCEPT` (Root executes) |
| **Issuance** | **Soft Channel** (Digital Scan) | **Flag** | Routes to Root Queue as `FLAGGED` (Root decides execution) |
| **Revocation** | **Hard or Soft Channel** | **Approve** | 🔒 **Routes to Root Queue** (Never auto-executes; Root execution mandatory) |
| **Any Request** | Hard or Soft | **Reject** | ⛔ Closed immediately as `REJECTED` (Logged in audit trail) |
| **Key Rotation** | System Infrastructure | **Request** | 🔑 Routes to Root for verification and dual-key activation |

---

## 4. Roles & Privileges at a Glance

| Role | Operational Surface | Network Subnet | Authentication | Execution Capability |
|---|---|---|---|---|
| **Public Visitor** | Public Sandbox | Public | None | *Deferred / Disabled in initial rollout* |
| **Help Desk Clerk** | Client Portal | Counter VPN (`10.20.0.0/24`) | Argon2id Password | Intake only (Issue, Revoke, Direct Verify); no moderation or queue visibility |
| **Moderator (Mod)** | Internal Dashboard | Management LAN (`10.10.0.0/24`) | Argon2id + TOTP MFA | Approve/Reject/Flag; **Auto-executes Hard-Channel Issuance ONLY** |
| **Root Administrator** | Internal Dashboard | Management LAN (`10.10.0.0/24`) | Argon2id + TOTP MFA | Full execution: Soft Issuance, all Revocations, PQC Key Rotation, User Management |
| **Emergency Break-Glass** | Terminal CLI (`admin_cli.js`) | Host Local (`127.0.0.1` / SSH) | Direct Root Keys / Passphrase | Offline recovery, TOTP secret resets, SQLite integrity restore, direct PQC rotation |

---

## 5. Network Zoning Summary

```
                      [ INTERNET / EXTERNAL ]
                                 |
                                 v
                 [ Perimeter Firewall / WireGuard ]
                                 |
         +-----------------------+-----------------------+
         |                                               |
         v                                               v
[ Counter VPN: 10.20.0.0/24 ]           [ Management LAN: 10.10.0.0/24 ]
- Help Desk Clerks                      - Internal Ops Dashboard (:8080)
- Client Portal UI (:3000)              - Appsmith Backend / Engine
- Direct Verification Requests          - Mod & Root Operators
         |                                               |
         | (ALLOWED: :3000)                              | (ALLOWED: :8080, :5000, :7051)
         | (BLOCKED: :8080, :5000, Fabric)               |
         +-----------------------+-----------------------+
                                 |
                                 v
             [ Core Secure Dataplane: 127.0.0.1 / Docker Bridge ]
             - ScatterID Verification Gateway (:5000)
             - Hyperledger Fabric Peer & Orderer (:7051, :7050)
             - PQC Signer & Vault
             - SQLite Database & Immutable Audit Log
```

---

## 6. Disaster Recovery & Key Lifecycle Highlights

1. **Self-Service MFA Phone Migration**: Admins can migrate TOTP to a new phone without SSH or database modification via verified re-enrollment with current password confirmation.
2. **Offline Recovery Codes**: 8 single-use cryptographically random codes (SHA-256 hashed in database) for emergency authentication without an authenticator app.
3. **Break-Glass CLI**: Host-level `tools/admin_cli.js` allows direct administrative recovery when the web container or network is offline.
4. **Zero-Downtime Dual-Key Rotation**: Gateway API keys support primary + grace period keys, eliminating downtime during credential updates.
5. **Advance Key Pre-Distribution (Primary Standard)**: Future PQC signing keys are pre-generated 3–6 months in advance and pre-staged on all offline verifier keyrings, guaranteeing zero unknown-key rejections upon rotation.
6. **Cryptographic Delegation Endorsements (Disaster Fallback)**: If the pre-staged key pool is compromised, fresh emergency keys are certified by the outgoing key via delegation tokens, maintaining offline verifiability without firmware pushes.
7. **Encrypted PQC Key Backups**: PQC key pairs exported as AES-256-GCM encrypted bundles (`.enc`) with scrypt KDF.

---

## 7. Change History

- **v1.0**: Baseline implementation (flat admin/viewer dashboard, public demo sandbox).
- **v2.0**: Introduction of Mod/Root dual-custody model, verification channel addendum (Hard/Soft), and operational Help Desk mode.
- **v2.1 (Current)**:
  - Adopted **Scenario B: Tiered Risk** (Hard-channel issue auto-executes upon Mod approval; Soft-channel issue and all revocations strictly require Root execution).
  - Enforced **Network Micro-segmentation** (3-zone model separating Counter VPN `10.20.0.0/24` from Ops Dashboard `10.10.0.0/24`).
  - Added **Comprehensive Disaster Recovery & Key Lifecycle** specification (`06-disaster-recovery-and-key-lifecycle.md`).
  - Added **Dedicated Network Architecture** specification (`07-network-topology-and-segmentation.md`).
  - Formalized **Clerk Audit Attribution** stamping.
  - Deferred public sandbox mode to focus exclusively on hardened internal operations.


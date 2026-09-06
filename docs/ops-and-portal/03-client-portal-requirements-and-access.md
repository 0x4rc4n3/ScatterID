# ScatterID Client Portal & Help Desk — Requirements, Roles & Access

## 1. Purpose & Scope — Operational Focus & Internal Help Desk

This portal serves as the frontline intake interface for ScatterID operations:

- **Help Desk (Operational) Mode — Primary Production Focus**: Authenticated Help Desk clerks operate this portal over a secure, dedicated Counter VPN or intranet. Clerks intake identity credential issuance and revocation requests, verify physical or digital documentation, and perform real-time credential verification queries against the Verification Gateway.
- **Sandbox/Demo Mode — Deferred for Initial Rollout**: The public-facing sales/evaluation sandbox (Holder Studio, Tamper Simulator) is **shelved and disabled for initial release** by design decision to minimize attack surface and prioritize core operational security. Code hooks remain in architecture for future activation if desired.

Help Desk mode requires authenticated sessions backed by ScatterID's internal credential store and communicates strictly with the local Verification Gateway API.

## 2. Network & Deployment Context — Isolated Network & Counter VPN

Per the network architecture defined in `07-network-topology-and-segmentation.md`:

- **Single Isolated Core Network**: All ScatterID services (Verification Gateway, Fabric Peer/Orderer, Ledger, Internal Ops Dashboard, and Help Desk Portal) run within an isolated virtual network environment.
- **Dedicated Counter VPN Subnet (`10.20.0.0/24`)**: Remote or branch Help Desk clerks access the Client Portal strictly via an encrypted VPN tunnel (WireGuard / OpenVPN).
- **Strict Micro-Segmentation & Firewall ACLs**: 
  - VPN users on `10.20.0.0/24` are routed exclusively to the Client Portal HTTP/HTTPS port (e.g. `10.20.0.1:3000`).
  - **Zero Access to Ops Dashboard or Backend Ports**: iptables/firewall rules strictly block Help Desk VPN clients from accessing the Internal Ops Dashboard (`:8080`), Appsmith admin, raw PostgreSQL/SQLite, or Docker management sockets (`10.10.0.0/24` and `127.0.0.1`).
  - Help Desk staff cannot probe, view, or authenticate against the Internal Dashboard.
- **Local Account Storage**: Help Desk clerk user accounts, argon2id password hashes, and station assignments are stored locally inside ScatterID's secure auth store (SQLite `users` table). No external third-party IdP or cloud dependency is required for counter operations.

## 3. Roles, Access & Audit Attribution

| Role | Network Access | Auth Required | Capabilities & Scope |
|---|---|---|---|
| **Public Visitor** (Sandbox) | Public / Disabled | N/A | *Deferred / Disabled in initial release* |
| **Help Desk Clerk** | Counter VPN (`10.20.0.0/24`) or On-Prem Counter LAN | Yes (Username + Password + Session Token) | Issue Desk, Verify Desk, Revoke Desk, Request Status Tracking |

There is no supervisory or execution role on this portal — Mod and Root roles exist exclusively on the Internal Ops Dashboard (`10.10.0.0/24`). A Help Desk clerk **cannot** access the moderation queue, cannot approve or reject requests, and cannot trigger Hyperledger Fabric chaincode executions.

### 3.1 Clerk Audit Attribution (Mandatory)

Every request initiated from the Help Desk portal carries an immutable cryptographic audit attribution stamp:

```json
{
  "staff_user_id": "clk_042",
  "username": "alice_counter",
  "station_id": "counter-station-03",
  "ip_address": "10.20.0.14",
  "submission_channel": "hard",
  "timestamp": "2026-09-05T16:30:00Z"
}
```

This attribution is logged to the tamper-evident SQLite audit log and permanently recorded in request metadata forwarded to the Moderation Queue on the Internal Dashboard.

### 3.2 Help Desk Desk Scoping (`HELP_DESK_SCOPE`)

Clerk privileges can be configured via environment settings:

| ID | Requirement | Detail |
|---|---|---|
| FR-C4 | Config flag `HELP_DESK_SCOPE` = `all` or `per-desk` | When `all`, any authenticated clerk accesses Issue, Verify, and Revoke desks. When `per-desk`, accounts are restricted to assigned duties (e.g., Verify-only intake). Default: `all`. |

## 4. Features & Operational Workflows

### 4.1 Help Desk Desks

| ID | Requirement | Desk | Detailed Workflow & Routing |
|---|---|---|---|
| FR-H1 | Mandatory Clerk Authentication | All | Argon2id session authentication over HTTPS/VPN. Auto-logout on idle timeout (15 min). |
| FR-H2 | Issue Desk Intake & Verification Channel | Issue | Collects claimant data, identity attributes, and mandatory channel selection (Hard vs. Soft). |
| FR-H3 | Issue Desk Submission & Queue Routing | Issue | Submits request to Internal Dashboard. Under **Scenario B Tiered Risk**:<br>• **Hard Channel** (physical inspection checklist verified): Upon Mod explicit approval, auto-executes directly on Hyperledger Fabric.<br>• **Soft Channel** (digital scan upload): Upon Mod approval, routes to Root for final authorization and execution. |
| FR-H4 | Verify Desk Direct Verification | Verify | Direct, read-only Level-1 (hash) and Level-2 (PQC signature) verification against live Verification Gateway. No queue or moderator approval required. |
| FR-H5 | Revoke Desk Intake & Strict Root Routing | Revoke | Collects credential ID, reason code, and evidence channel. Under **Scenario B Tiered Risk**, all revocation requests strictly require Root approval & execution (never auto-executed). |
| FR-H6 | Request Tracking Lookup | Issue, Revoke | Allows clerk to query request lifecycle by Request ID (`Pending` → `Under Review` → `Executed` / `Rejected`). No internal mod comments or secret keys exposed. |
| FR-H7 | Front-Desk-Skip Toggle | Issue, Revoke | Controlled by `FRONT_DESK_ENABLED` flag (see §4.2). |

### 4.2 Front-Desk-Skip Configuration

| ID | Requirement |
|---|---|
| FR-C1 | `FRONT_DESK_ENABLED` (`true` / `false`), evaluated at runtime. |
| FR-C2 | When `true` (default), all Issue and Revoke requests require intake through an authenticated Help Desk clerk. |
| FR-C3 | When `false`, direct claimant submission interface is exposed (subject to client portal auth rules). Channel attribution is always preserved. |

### 4.3 Sandbox Mode (Deferred Specification)

*Maintained for reference when public evaluation mode is reactivated:*
- Presets: RFC 8785 canonical JSON live preview, client-side CSPRNG salt generation, simulated Level-1/Level-2 verification, byte-flip tamper simulator, and clear sandbox warning banners.

## 5. Security & Non-Functional Requirements

- **NFR-1 — Micro-segmented Network Boundary**: The portal must be completely inaccessible to unauthenticated external traffic. Help Desk clerks on VPN subnet `10.20.0.0/24` are strictly blocked by network firewall from accessing the Internal Dashboard port (`:8080`).
- **NFR-2 — Audit Completeness**: All intake actions must stamp clerk identity, client IP, counter station, and timestamp.
- **NFR-3 — Low Latency Intake UX**: UI components built with Flowbite/Tailwind for rapid data entry without complex build pipelines. Form state cached locally in-session so network blips do not discard filled claimant data.
- **NFR-4 — Responsive Tablet & Desktop Support**: Optimized for standard desktop intake terminals and counter tablets (≥768px viewports), gracefully degrading to 375px mobile viewports.
- **NFR-5 — Zero Credential Exposure**: Private keys and Hyperledger admin certificates never reside or pass through the Client Portal container.

## 6. Repository & Working Branches

- **Core Backend Service**: `ScatterID` repo (branch `feat/ops-dashboard`) — houses request queue schema, SQLite auth store, gateway API proxy, and iptables configuration.
- **Portal Frontend Service**: `ScatterID-app` repo (branch `feat/client-portal`) — houses Help Desk UI screens (`public/`), desk controllers, and session management.

## 7. Acceptance Criteria

- [ ] Help Desk portal is accessible strictly through the designated Counter VPN / Intranet IP range.
- [ ] Network firewall blocks Help Desk VPN clients from connecting to the Internal Ops Dashboard on port 8080.
- [ ] Clerk login requires valid credentials stored in the internal auth database with Argon2id hashing.
- [ ] Every Issue and Revoke submission records full clerk attribution (`staff_user_id`, `username`, `station_id`, `channel`, `timestamp`).
- [ ] Hard-channel issue requests display physical document inspection checklists and no file upload.
- [ ] Soft-channel issue requests enforce digital scan/PDF file upload.
- [ ] Direct verify requests return real Level-1 and Level-2 cryptographic verification results from the live gateway.
- [ ] Requests submitted via Help Desk populate the Moderation Queue on the Internal Dashboard within 500ms.
- [ ] Sandbox/Demo mode is explicitly disabled in the default production deployment configuration.

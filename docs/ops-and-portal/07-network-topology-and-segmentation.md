# ScatterID — Network Topology, Segmentation & Access Control

**Document ID:** SEC-NET-07  
**Status:** Approved Architectural Standard  
**Companion Documents:** `01-internal-dashboard-requirements-and-access.md`, `03-client-portal-requirements-and-access.md`, `06-disaster-recovery-and-key-lifecycle.md`

---

## 1. Network Philosophy: Zero Public Ingress

In the enterprise deployment model for ScatterID, the entire core infrastructure operates within an **isolated private network perimeter**. 

There is **zero public internet ingress** exposed by default. All interactions are gated behind corporate VPN gateways, on-premises management LANs, or air-gapped offline verification workflows.

---

## 2. Network Microsegmentation & Zoning

To prevent lateral movement and privilege escalation, the network is partitioned into three distinct operational zones:

```
                           [ UNTRUSTED INTERNET ]
                                     │
                                     ▼
                           [ Corporate VPN Router ]
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         │                                                       │
         ▼ (Counter / Help Desk VPN)                             ▼ (Admin / Management Zone)
  [ ZONE 1: Counter Desk ]                                [ ZONE 2: Management Ops ]
  - Subnet: 10.20.0.0/24                                  - Subnet: 10.10.0.0/24 (or On-Prem LAN)
  - Users: Help Desk Clerks                               - Users: Moderators (Mod) & Root Admins
  - Permitted Target: Client Portal (:5000)               - Permitted Target: Ops Dashboard (:8080)
  - Denied Targets: Ops Dashboard ⛔, Backend APIs ⛔       - Blocked from Clerk Counter Traffic
         │                                                       │
         │ (HTTP Intake REST Calls)                              │ (Administrative REST Calls)
         └───────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │   ZONE 3: Core Engine & Dataplane   │
                  │   (Docker Internal Bridge Network)  │
                  ├─────────────────────────────────────┤
                  │ - verification-api (:3000)          │
                  │ - crypto-service (:5001 mTLS)       │
                  │ - Hyperledger Fabric Peer Nodes     │
                  │ - Vault KMS & SQLite Storage        │
                  └─────────────────────────────────────┘
```

---

## 3. Zone Definitions & Firewall Rules

### Zone 1: Counter Desk / Staff VPN Zone (`10.20.0.0/24`)
- **Target Audience:** Front-line identity clerks, counter officers, customer service intake staff.
- **Allowed Ingress:**
  - `ALLOW TCP 5000` $\rightarrow$ `ScatterID-app` (Client Portal in Help Desk Mode).
- **Strictly Denied Targets (Dropped at Firewall):**
  - `DENY TCP 8080` $\rightarrow$ `Internal Ops Dashboard (Appsmith)` ⛔
  - `DENY TCP 3000` $\rightarrow$ `verification-api` (Raw Gateway API) ⛔
  - `DENY TCP 5001` $\rightarrow$ `crypto-service` ⛔
  - `DENY TCP 7050-9051` $\rightarrow$ `Fabric Orderer / Peer Ports` ⛔

### Zone 2: Management & Security Operations Zone (`10.10.0.0/24` or On-Prem LAN)
- **Target Audience:** Security Operations, Compliance Officers (Mod), Senior Infrastructure Engineers (Root).
- **Access Vectors:** Physically secured headquarters workstations, hardened Bastion/Jump hosts, or dedicated Admin VPN with hardware token enforcement.
- **Allowed Ingress:**
  - `ALLOW TCP 8080` $\rightarrow$ `Internal Ops Dashboard (Appsmith)`.
  - `ALLOW TCP 3000` $\rightarrow$ `verification-api` (Scoped administrative bearer endpoints).
- **Access Rule:** VPN clients from Zone 1 cannot route into Zone 2.

### Zone 3: Core Engine & Dataplane (Docker Isolated Network)
- **Target Audience:** Internal microservice communication only.
- **Configuration:** Bound to `127.0.0.1` on the host or isolated within an unrouted Docker bridge network (`scatterid_backend`).
- Ports `:5001` (`crypto-service`) and `:7051` (`Fabric peer`) are **never exposed to the host network interface** without mutual TLS (mTLS).

---

## 4. Docker Compose Port Topology & Host Binding

To enforce this segmentation at the container orchestration layer:

```yaml
services:
  # Client Portal (Accessible to Help Desk VPN Subnet)
  client-portal:
    image: scatterid-app:latest
    ports:
      - "10.20.0.10:5000:5000" # Bound strictly to the Counter VPN interface

  # Internal Ops Dashboard (Accessible ONLY to Management Subnet / On-Prem LAN)
  ops-dashboard:
    image: appsmith/appsmith-ce:latest
    ports:
      - "10.10.0.10:8080:8080" # Bound strictly to the Management LAN interface

  # Verification Gateway (Internal Loopback / Backend Bridge Only)
  verification-api:
    image: scatterid-verification-api:latest
    networks:
      - scatterid_backend
    # No direct public host port mapping; accessed via reverse proxy or internal bridge

  # PQC Crypto Microservice (mTLS Internal Bridge Only)
  crypto-service:
    image: scatterid-crypto-service:latest
    networks:
      - scatterid_backend
    # Zero external exposure
```

---

## 5. Third-Party & Public Verification Patterns

If the entire core operates behind a VPN, how do external partners or field agents verify a credential?

### Pattern A: Air-Gapped Offline Verification (Recommended Default)
- External verifiers do **not** connect to the organization's network.
- Verifiers run the decoupled CLI verifier:
  ```bash
  python3 tools/verify_offline.py --credential credential.json --public-key issuer_pubkey.hex
  ```
- **Guarantees:** Verifies RFC 8785 canonical hash, CSPRNG salt commitment, and NIST FIPS 204 ML-DSA-65 signature 100% offline with zero network packets emitted.

### Pattern B: Isolated Verification Reverse Proxy (DMZ)
- If an automated online verification check is required by external partners:
  - Deploy a lightweight, unauthenticated reverse proxy in the network DMZ.
  - The proxy allows **only** `POST /verify` and strictly drops all other paths (`/issue`, `/revoke`, `/status`, `/audit`, `/reconciliation`).
  - Strict rate limiting (`express-rate-limit`) and payload limiters (`100kb`) are enforced at the DMZ ingress.

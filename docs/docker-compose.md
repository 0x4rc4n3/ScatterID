# Component Technical Specification: docker-compose.yml
Document ID: SEC-NET-07 / DEV-ARCH-08

## 1. Purpose & Core Responsibility
- Defines and orchestrates multi-container service configurations for the complete ScatterID ecosystem.
- Implements native **3-Zone Zero Trust Network Microsegmentation** directly in Docker Compose bridge networks.
- Enforces strict network isolation between Counter Clerks, Security Moderators / Root Admins, and Internal Dataplane microservices.

## 2. Network Topology & Microsegmentation Manifest

| Network Zone | Subnet | Permitted Containers | Permitted Host / Ingress Ports | Boundary Guarantees |
| :--- | :--- | :--- | :--- | :--- |
| **Zone 1: Counter Subnet** (`zone1_counter_net`) | `10.20.0.0/24` | `scatterid-client-portal` (:5000) | `5000` (Help Desk Portal) | Strictly isolated from Zone 2 (`10.10.0.0/24`). Counter clerks have zero network routes to the Operations Console. |
| **Zone 2: Management Subnet** (`zone2_mgmt_net`) | `10.10.0.0/24` | `scatterid-ops-dashboard` (:8080) | `8080` (Ops Dashboard) | Strictly isolated from Zone 1. Accessible only to authenticated security staff and Root administrators. |
| **Zone 3: Core Dataplane** (`zone3_dataplane_net`) | `10.30.0.0/24` | `scatterid-crypto` (:5001), `scatterid-verification` (:3000), `ops-dashboard`, `client-portal` | Internal only (`3000`, `5001`) | Holds core signing oracle, Fabric blockchain ledger, and SQLite audit stores. |

## 3. Service Configuration Schema
- **`scatterid-crypto` (`:5001`)**:
  - Attached strictly to `zone3_dataplane_net` (`10.30.0.10`).
  - High-assurance ML-DSA-65 post-quantum signing engine with internal mTLS certificate authentication.
- **`scatterid-verification` (`:3000`)**:
  - Attached strictly to `zone3_dataplane_net` (`10.30.0.11`).
  - Verification Gateway API enforcing `VERIFICATION_API_KEY` and dedicated `REVOKE_API_KEY`.
- **`scatterid-ops-dashboard` (`:8080`)**:
  - Dual-homed on `zone2_mgmt_net` (`10.10.0.10`) and `zone3_dataplane_net` (`10.30.0.12`).
  - Executive operations console with Argon2id, RFC 6238 TOTP, rate limiting, and server-side token revocation.
- **`scatterid-client-portal` (`:5000`)**:
  - Dual-homed on `zone1_counter_net` (`10.20.0.10`) and `zone3_dataplane_net` (`10.30.0.13`).
  - Front-desk intake portal for credential issuance, verification, and revocation requests.

## 4. Security & Compliance Posture
- **Zero Cross-Zone Bridging**: Docker bridge isolation ensures that containers in Zone 1 cannot route packets or resolve containers in Zone 2.
- **Defense in Depth**: Container network separation is paired with host-level iptables rules (`scripts/network/apply_iptables.sh`) and WireGuard counter VPNs (`scripts/network/wireguard/`).
- **Fail-Fast Secrets**: Refuses to start if mandatory environment variables (`JWT_SECRET`, `VERIFICATION_API_KEY`, `REVOKE_API_KEY`, `CRYPTO_SERVICE_API_KEY`) are missing or below 256-bit entropy.

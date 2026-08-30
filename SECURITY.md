# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Key Hierarchy & Least-Privilege Access Control

ScatterID separates cryptographic operational roles into tiered authorization scopes to ensure zero-trust boundaries:

| Key Name | Scope / Target | Access Level | Description |
| :--- | :--- | :--- | :--- |
| **`VERIFICATION_API_KEY`** | Gateway (`/issue`, `/status/:id`, `/credentials`, `/audit`) | Operator / Application | Required for standard issuance, audit inspections, and status queries. |
| **`REVOKE_API_KEY`** | Gateway (`POST /revoke`) | Tier-1 Administrative Authority | Narrowly scoped secret required for irreversible on-chain revocation (`RevokeProof`). Must be restricted to authorized compliance officers. |
| **`GATEWAY_API_KEY`** | Dashboard Console (`/api/*`) | Dashboard Proxy | Session access key for the local operator observability console. |
| **`CRYPTO_SERVICE_API_KEY`** | Crypto Service (`https://localhost:5001`) | Internal mTLS / Vault | Internal bearer secret for post-quantum signing (`ML-DSA-65`) and Vault key rotation. |

## Reporting a Vulnerability

If you discover a security vulnerability in ScatterID, **please do not open a public GitHub issue.**

Instead, report it responsibly via email:

- **Email:** security@scatterid.com
- **Subject:** `[SECURITY] <Brief description>`

Please include:
1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Any suggested remediation (optional)

## Our Commitment

- We will acknowledge receipt within **3 business days**.
- We will provide an initial severity assessment within **10 business days**.
- We will keep you informed of remediation progress for Critical/High findings.
- We will credit you publicly (with your permission) once the fix is released.

## Safe Harbor

Good-faith security research conducted under these guidelines will not result in legal action. We ask that you:
- Report privately first and allow reasonable time (90 days) to fix before public disclosure.
- Do not access, modify, or exfiltrate data beyond what is necessary to demonstrate the vulnerability.
- Do not test against production without prior authorization if the vulnerability could cause service disruption.

## Severity Response Targets

| Severity    | Response Target                                   |
| ----------- | ------------------------------------------------- |
| Critical    | Fix within days; emergency process if exploitable |
| High        | Fix within 1–2 weeks                              |
| Medium/Low  | Fix in next regular release cycle                 |

## Scope

- **In scope:** All code in this repository — Verification API, Crypto Service, SDK, Dashboard.
- **Out of scope:** Third-party infrastructure, social engineering, and denial-of-service testing against production.

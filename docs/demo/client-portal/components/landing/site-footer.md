# Component Technical Specification: site-footer.tsx

## 1. Purpose & Core Responsibility
- Renders the legacy multi-column footer for the ScatterID platform.
- Deprecated in favor of the inline `5vh` footer bar implemented in `cta.tsx` to align with the Bank-Grade layout Snapping Standard.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - None (Deprecated/Legacy component).
- **Explicitly Denied Inbound:** 
  - All calls are dropped.
- **Allowed Outbound (Who this file can talk TO):** 
  - DOM scroll interfaces (`window.scrollTo`).
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **`SiteFooter()`**
  - **Purpose:** Renders legacy footer links and logo.
  - **Inputs & Sanitization:** None.
  - **Outputs:** React footer component.

## 4. Security & Compliance Posture
- Static presentation layout.

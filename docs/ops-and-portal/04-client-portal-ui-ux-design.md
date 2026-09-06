# ScatterID Client Portal & Help Desk — UI/UX Design Doc

*Companion doc: `03-client-portal-requirements-and-access.md` covers functional requirements, network boundaries, and access rules. This doc covers visual layout, component states, and clerk interaction patterns.*

**Builder:** Flowbite (Tailwind CSS component library), zero build step required — assembled from existing cards, forms, badges, modals, and alerts.

## 1. Design Principles & Operational Focus

- **Primary Interface: Operational Help Desk**: The primary interface is an authenticated, low-friction operational console for intake clerks. No marketing copy, no simulated animations. Fast, reliable data entry for counter operations.
- **Sandbox Mode Deferred**: Public demo / sandbox interfaces are **deferred and disabled** in initial production rollout. Architecture retains structural styling classes if reactivated later.
- **Unambiguous Audit Attribution**: The clerk must always see who they are authenticated as, their assigned intake station ID, and network security status in a persistent top bar.
- **High-Contrast Channel Distinction**: Clerks must immediately perceive the difference between **Hard Channel** (in-person physical inspection) and **Soft Channel** (digital upload) intake workflows.

## 2. Global Header & Clerk Station Bar

A persistent, dark-slate header (`bg-slate-900 text-slate-100 border-b border-slate-800`) sits at the top of every screen:

```
+-----------------------------------------------------------------------------------------------+
|  [ScatterID Help Desk]   Desk: [Issue | Verify | Revoke]       Clerk: Alice (clk_042)        |
|                                                                Station: Counter-03 [VPN OK]   |
|                                                                [Security / Pass] [Log Out]    |
+-----------------------------------------------------------------------------------------------+
```

- **Live Status Indicator**: Green pulse dot with `VPN Connected (10.20.0.14)` verifying the clerk is inside the secure counter network zone.
- **Clerk Identity Badge**: Monospace pill showing `clk_042 | Station Counter-03`.
- **Quick Links**:
  - Direct link to `Request Tracking Lookup` modal.
  - Clerk Security dropdown: `Change Password`, `View Session Details`.

## 3. Help Desk Desks — Layouts & Workflows

### 3.1 Issue Desk

Form structured in three clear vertical sections using Flowbite Card containers:

#### Section 1: Claimant Details
- Claimant Full Legal Name (`input[type="text"]`)
- Claimant Date of Birth / Identifier (`input[type="date"]`)
- Credential Type Selector (`select`: National ID, Civil Registry, Professional Credential)
- Attribute key-value pairs (dynamically rendered based on credential type schema)

#### Section 2: Verification Channel Selector (Crucial Interactive Component)
Two large, clickable radio cards side-by-side:

```
+------------------------------------------+  +------------------------------------------+
| (*) HARD CHANNEL                         |  | ( ) SOFT CHANNEL                         |
|     Physical Document Inspected In-Person|  |     Digital Upload / Scan Submission     |
|     (Fast-track: Auto-executes upon Mod) |  |     (Escalates: Requires Mod + Root)     |
+------------------------------------------+  +------------------------------------------+
```

- **When "HARD CHANNEL" is active**:
  - File upload widget is **hidden**.
  - Renders **Physical Document Inspection Checklist** (Flowbite checkbox group):
    - [ ] Physical document presented in original form (no photocopies)
    - [ ] Security features inspected (UV watermark / holographic seal / microtext)
    - [ ] Facial likeness matched against in-person claimant
    - [ ] Physical condition of document verified (no tampering / delamination)
  - Textarea: `Inspector Observations / Document Serial Number` (required).

- **When "SOFT CHANNEL" is active**:
  - Checklist is **hidden**.
  - Renders **Document Upload Zone** (Flowbite drag-and-drop file upload):
    - Supported formats: `.pdf`, `.png`, `.jpeg` (Max 15MB).
    - Client-side SHA-256 hash calculated and displayed in monospace preview immediately upon file drop.
  - Notice badge: *"Soft channel submissions require supervisory Root review before issuance."*

#### Section 3: Audit Attribution & Submission
- Summary card displaying the exact attribution stamp that will accompany the request:
  - `Submitted By: Alice (clk_042) | Station: Counter-03 | Channel: HARD`
- Button: `Submit Credential Request` (Flowbite Primary Blue button).
- **Post-Submission Confirmation Modal**:
  - Flowbite Success Alert.
  - Large monospace Request ID: `REQ-2026-0905-HARD-08421` (one-click copy button).
  - Workflow routing explanation:
    - *Hard Channel:* "Forwarded to Moderator Queue for direct verification & auto-issuance."
    - *Soft Channel:* "Forwarded to Moderator Queue. Root authorization required."

---

### 3.2 Verify Desk

A zero-latency, direct verification console connected to the local Verification Gateway:

- **Input Methods**:
  - Tab 1: **Upload Credential File** (`.json` credential token)
  - Tab 2: **Paste Credential JSON / Hash**
  - Tab 3: **Scan QR Code** (via counter camera or USB barcode scanner)
- **Action**: Flowbite button: `Run Immediate Verification`.
- **Result Display**:
  - Two prominent status cards side-by-side (never merged into one):
    - **Level 1 Verification (Integrity)**:
      - Green Badge: `PASSED: RFC 8785 Canonical Hash Matches SHA-256 Payload`
      - Shows calculated hash vs embedded hash.
    - **Level 2 Verification (Authenticity & PQC Signature)**:
      - Green Badge: `PASSED: ML-DSA-87 Quantum-Safe Signature Valid`
      - Displays Signer Key ID: `pqc-mldsa-root-v2` and Ledger Status: `ACTIVE (Hyperledger Fabric)`.
  - If Revoked:
    - Red Alert Box: `FAILED / REVOKED: Credential was revoked on 2026-08-12. Reason: Reported Lost.`

---

### 3.3 Revoke Desk

Intake interface for credential revocation requests:

- Credential ID search field (auto-completes active credentials if connected).
- Revocation Reason Selector (`dropdown`):
  - `Key Compromise / Credential Lost`
  - `Claimant Identity Data Superseded`
  - `Administrative Withdrawal / Fraud Discovered`
  - `Claimant Deceased`
- Revocation Channel Selector (Hard vs Soft with same radio-card UI as Issue Desk).
- **High-Impact Confirmation Dialog**:
  - Modal with warning banner: *"Revocation permanently invalidates this credential on Hyperledger Fabric. Under Tiered Risk controls, all revocations require final authorization and execution by the Root Administrator."*
  - Submit generates Request ID: `REQ-2026-0905-REV-00192`.

---

### 3.4 Request Status Lookup Modal

- Monospace search input: `Enter Request ID (e.g. REQ-2026-...)`.
- Returns interactive progress stepper:
  - Step 1: `Submitted by Counter` (Completed - Green)
  - Step 2: `Moderator Review` (In-Progress - Blue, or Completed)
  - Step 3: `Root Authorization` (Pending for Soft/Revoke, Skipped for Hard Issue)
  - Step 4: `Ledger Execution` (Executed - Green, or Rejected - Red)
- Does not disclose internal secret keys, moderator private remarks, or internal logs to the clerk.

---

### 3.5 Clerk Security & Password Update Screen

Modal accessible from Clerk Profile in top header:
- `Current Password` input.
- `New Password` input (enforces min 12 characters, complexity meter).
- `Confirm New Password` input.
- Displays station details and session expiry timer.

## 4. Color Palette & Accessibility

| Element | Palette | Standard |
|---|---|---|
| Background (App) | `bg-slate-50 dark:bg-slate-900` | WCAG AAA |
| Station Bar | `bg-slate-900 text-slate-100` | High contrast |
| Hard Channel Accent | `border-blue-600 bg-blue-50/20` | Clearly distinguishable |
| Soft Channel Accent | `border-amber-600 bg-amber-50/20` | Distinct amber tone |
| Level-1 Hash Valid | `bg-emerald-100 text-emerald-800 border-emerald-500` | Standard green |
| Level-2 PQC Valid | `bg-teal-100 text-teal-800 border-teal-500` | Standard teal |
| Rejected / Revoked | `bg-rose-100 text-rose-800 border-rose-500` | Unambiguous red |

## 5. Responsive Behavior

- **Counter Tablet (≥768px)**: Primary operational target. Two-column layouts for channel selector cards and verification results.
- **Intake Terminal (Desktop ≥1024px)**: Full width layout with quick lookup drawer.
- **Compact Viewport (375px–640px)**: Channel selector cards and verification badges stack vertically into single columns. Monospace hashes wrap or display with horizontal overflow scroll.


# ScatterID — Verification Channel & Escalation Addendum

**Document ID:** ADDENDUM-01  
**Status:** In Force & Normative  
**Companion Documents:** `01-internal-dashboard-requirements-and-access.md`, `03-client-portal-requirements-and-access.md`

---

## 1. Purpose & Scope

This addendum defines the evidentiary standards, operational distinctions, and routing behavior for credential requests based on the **Verification Channel**:
1. **Hard Channel**: In-person, physical verification of tangible identity documents.
2. **Soft Channel**: Digital submission of electronic document scans, photographs, or PDFs.

It establishes how the verification channel interfaces with moderator decisions (Approve, Reject, Flag) and system execution policies under **Scenario B: Tiered Risk**.

---

## 2. Verification Channel Definitions

### 2.1 Hard Channel (Physical In-Person Inspection)

- **Definition**: The credential claimant presents their original, physical identity document in-person at an authenticated Help Desk counter station.
- **Physical Inspection Requirements**:
  The intake clerk must personally inspect the physical document against four mandatory security checkpoints:
  1. **Substrate & Material Integrity**: Verification that the document is on genuine security paper or polycarbonate card substrate (no color photocopies, laminate tampering, or surface alterations).
  2. **Optical Security Features**: Inspection of holographic foils, optical variable ink (OVI), UV watermarks, and micro-printing under counter magnification and UV light.
  3. **Biometric Face Match**: Visual likeness comparison between the claimant standing at the counter and the physical document photograph.
  4. **Document Serial / Issuing Authority Seal**: Tactile and visual verification of embossed or stamped authority seals and sequential serial numbers.
- **Data Minimization & Storage Policy**:
  - In Hard Channel workflows, **no digital scan or photocopied image of the document is captured or retained**.
  - Only the structured claimant attributes, the document serial number, and the completed clerk inspection checklist are submitted.
  - This drastically reduces the organizational liability and storage surface for sensitive PII.

### 2.2 Soft Channel (Digital Submission)

- **Definition**: The credential claimant or authorized representative submits digital copies of identity documents (PDF, PNG, JPEG) through the Help Desk intake interface or remote client endpoint.
- **Digital Evidentiary Requirements**:
  1. **Cryptographic Integrity**: The system immediately calculates and records the SHA-256 hash of the uploaded document payload upon receipt.
  2. **Resolution & Legibility**: Minimum 300 DPI scan resolution, uncropped borders, all security elements and textual fields legible.
  3. **Metadata & Tamper Check**: Review for synthetic image generation artifacts, EXIF tampering, or anomalous compression layers.
- **Storage Policy**:
  - The document payload is stored in the encrypted internal document vault (AES-256-GCM) with restricted access limited to authorized moderators and root administrators during the review lifecycle.

---

## 3. Decision Matrix & Routing Rules (Scenario B: Tiered Risk)

| Channel Type | Request Type | Mod Action | System Routing & Execution Behavior |
|---|---|---|---|
| **Hard** | **Issuance** | **Approve** | ⚡ **AUTO-EXECUTION**: Ledger transaction is executed immediately on Hyperledger Fabric. Stamps Mod ID and Clerk attribution. |
| **Hard** | **Issuance** | **Flag** | Escalates to Root's **Flagged for Review** queue. Mod must supply a justification note. Root decides final action. |
| **Hard** | **Issuance** | **Reject** | Closed immediately as `REJECTED`. Reason recorded in audit log. No execution. |
| **Soft** | **Issuance** | **Approve** | Moves to Root's **Awaiting Accept** queue. Ledger execution is deferred until Root explicitly approves. |
| **Soft** | **Issuance** | **Flag** | Escalates to Root's **Flagged for Review** queue with Mod justification. |
| **Soft** | **Issuance** | **Reject** | Closed immediately as `REJECTED`. |
| **Hard or Soft** | **Revocation** | **Approve** | 🔒 **MANDATORY ROOT EXECUTION**: Moves to Root's **Awaiting Accept** queue. Revocations never auto-execute regardless of channel. |
| **Hard or Soft** | **Revocation** | **Flag** | Escalates to Root's **Flagged for Review** queue. |
| **Hard or Soft** | **Revocation** | **Reject** | Closed immediately as `REJECTED`. |

---

## 4. Failed Physical Inspection Protocol (Hard Channel)

If an in-person physical inspection fails at the intake counter or during moderator second-tier review:

1. **Suspected Counterfeit / Forgery**:
   - The clerk or moderator selects **Reject** or **Flag**.
   - Selects reason code `FRAUD_SUSPECTED` or `DOCUMENT_ALTERED`.
   - Notes specific failure points (e.g., "UV watermark absent", "Surface delamination detected").
   - The incident is permanently logged in the SQLite security incident audit trail.
2. **Damaged / Inconclusive Document**:
   - If the document is worn, torn, or inconclusive without malice, clerk selects `INCONCLUSIVE_PHYSICAL`.
   - The claimant is requested to obtain secondary certified documentation or re-verify through civil authority.

---

## 5. Audit Attribution Standard

Every transaction originating from either channel must record:
- `submission_channel`: `"hard"` or `"soft"`
- `inspection_checklist_verified`: `boolean` (true for Hard Channel)
- `evidence_sha256`: `string | null` (SHA-256 hash for Soft Channel; null for Hard Channel)
- `staff_user_id`: Unique identifier of the clerk
- `station_id`: Intake terminal or counter station
- `moderator_id`: Reviewing moderator identifier
- `timestamp`: UTC ISO 8601 timestamp

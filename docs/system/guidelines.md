# ScatterID Engineering Standard: The Bank-Grade Codebase Directive (SCS-01)

## 1. Core Mandates & Philosophical Stand

1. **Zero Tolerance for Temporary Fixes:** Quick hacks, band-aid patches, or "todo" comments bypassing validation are strictly prohibited. Every line of code must be production-ready and mathematically/logically sound.
2. **Defensive Rigor ("Bank-Grade" Standard):** Treat every atomic component as a high-security vault boundary handling sensitive zero-trust state. If a failure occurs, the system must fail-safe, isolate the error, and log cryptographically traceable telemetry without exposing internals.
3. **Explicit Communication Whitelisting:** Implicit trust is banned. Every component must explicitly define its inbound and outbound communication matrix. Anything not explicitly whitelisted is categorically denied (Default Deny).

---

## 2. Mandatory Component-Level Documentation Rule (`.md` Twin)

Every single code file in the repository **must** have a corresponding companion markdown file with the exact same base name (e.g., `crypto_engine.py` requires `crypto_engine.md`).

The companion `.md` file must strictly follow this template structure:

```markdown
# Component Technical Specification: [Filename]

## 1. Purpose & Core Responsibility
- Exact architectural purpose of this file within the ScatterID system.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - [Component / IP / Service Name] via [Protocol/Port], authorized by [Token/mTLS]. Explicitly list allowed callers.
- **Explicitly Denied Inbound:** 
  - All other callers, IP addresses, and services across the universe are strictly unsupported and dropped.
- **Allowed Outbound (Who this file can talk TO):** 
  - [Component / Target Service] via [Protocol/Port].
- **Explicitly Denied Outbound:** 
  - All other external connections are blocked.

## 3. Function & Method Manifest
- **`functionName(params)`**
  - **Purpose:** 
  - **Inputs & Sanitization:** Expected type, boundaries, and validation/sanitization rules applied.
  - **Outputs:** Expected return structure or response payload.
  - **Error States & Handling:** Complete list of potential failure modes (e.g., cryptographic timeout, schema violation, DB lock) and how they are handled safely (fail-safe mechanisms).

## 4. Security & Compliance Posture
- Least Privilege enforcement details.
- Error masking and audit logging protocols.

```

---

## 3. Coding Standards & Implementation Rules

### A. Strict Input/Output Sanitization & Validation

* **Inbound Validation:** No raw data is ever trusted. All inputs must pass through a strict schema validator (e.g., AJV for JavaScript, Pydantic for Python) before touching business logic.
* **Type Enforcement:** Strict typing must be enforced. Undefined, null, or out-of-bound values trigger immediate rejection.
* **SQL / Execution Safety:** String concatenation for queries or dynamic command execution is a critical violation. All database interactions must use parameterized statements or prepared bindings.

### B. Authorization & Least Privilege

* **Component-Level IAM:** Components run with the minimum necessary system permissions (non-root container execution where possible).
* **Token Verification:** Service-to-service requests must validate cryptographic identity via short-lived internal tokens (`X-Internal-Token`) and mTLS workload certificates.

### C. Multi-Layer Fallback & Error Handling

* **Fail-Safe Design:** If an external dependency (like HashiCorp Vault or a Shard Node) times out, the component must catch the exception, fail gracefully, and prevent cascading thread blocks.
* **Sanitized Error Responses:** Internal stack traces, database schemas, or raw memory pointers must **never** be returned to the client. Return generic, standardized error codes while logging the deep diagnostic trace securely to the internal audit log.

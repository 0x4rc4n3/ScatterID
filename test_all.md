# Component Technical Specification: test_all.sh

## 1. Purpose & Core Responsibility
- Acts as the central test execution runner for integration diagnostics and component unit verification.
- Probes and checks health states, executes round-trip packages, verifies anchor ledger entries, and triggers pytest assertions.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Operator terminal shell via manual trigger.
- **Explicitly Denied Inbound:** 
  - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
  - Verification API Gateway endpoint (`http://localhost:3000`).
  - KMS Crypto Service endpoint (`https://localhost:5001`).
  - Project Dashboard endpoint (`http://localhost:4000`).
  - Python Pytest test execution framework environment.
- **Explicitly Denied Outbound:** 
  - Any external endpoints not explicitly configured for validation.

## 3. Function & Method Manifest
- **Execution Validation Tracks:**
  - **Track 1**: Probes network configuration variables and asserts certificate presence.
  - **Track 2**: Performs active POST queries to `/package` and `/rotate` endpoints on KMS Crypto Service.
  - **Track 3**: Executes E2E package-anchor-reconstruct queries on the Verification API Gateway.
  - **Track 4**: Audits Dashboard status reports.
  - **Track 5**: Activates virtual Python environments and runs local pytest unit tests in the fragmentation module.

## 4. Security & Compliance Posture
- Cleans and regenerates ephemeral testing identities dynamically.
- Masks test credentials from diagnostic stdout dumps.

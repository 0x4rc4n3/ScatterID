# Component Technical Specification: server.js (Verification API)

## 1. Purpose & Core Responsibility
- Initializes and executes the primary HTTP API Express gateway for the verification service.
- Registers routes for credential issuance, status checks, verification, credentials querying, and shard healing.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - External clients and verifiers via HTTP on Port 3000.
- **Explicitly Denied Inbound:** 
  - Direct database or internal backend interface queries.
- **Allowed Outbound (Who this file can talk TO):** 
  - Express application routing sub-modules.
- **Explicitly Denied Outbound:** 
  - Direct network connections.

## 3. Function & Method Manifest
- **`GET /credentials`**
  - **Purpose:** Returns a list of all issued credential records from the fallback databases.
  - **Inputs & Sanitization:** N/A.
  - **Outputs:** JSON list of credentials metadata.
  - **Error States & Handling:** Database errors are masked and return generic `Internal Server Error` (HTTP 500).

- **`POST /heal-shards`**
  - **Purpose:** Synchronizes data and heals corrupted storage shards on a specific node.
  - **Inputs & Sanitization:** `nodeId` (body parameter). Validated to be an integer between 1 and 5.
  - **Outputs:** Success status and events array.
  - **Error States & Handling:** Operations exceptions return generic `Internal Server Error` (HTTP 500).

## 4. Security & Compliance Posture
- Restricts input ranges on parameters to prevent unauthorized or boundary-breaking calls.
- Enforces strict exception masking to prevent internal SQLite or file system metadata leakages.

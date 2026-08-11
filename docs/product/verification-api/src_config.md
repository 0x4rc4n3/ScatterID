# Component Technical Specification: config.js (Verification API)

## 1. Purpose & Core Responsibility
- Provides a centralized configuration loader for the verification gateway.
- Reads custom configuration files and parses environment properties using safe fallbacks.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Verification API modules via JavaScript imports.
- **Explicitly Denied Inbound:** 
  - External network API routes.
- **Allowed Outbound (Who this file can talk TO):** 
  - Read-only file system operations on the config JSON file (`/app/config.json`).
- **Explicitly Denied Outbound:** 
  - Write filesystem operations or network requests.

## 3. Function & Method Manifest
- **`getConfig(pathStr, fallback)`**
  - **Purpose:** Parses dot-notation settings values from the global config mapping.
  - **Inputs & Sanitization:** Dot-notation string path, fallback default value.
  - **Outputs:** Evaluated configuration element or the fallback value.
  - **Error States & Handling:** Safe fallbacks are used if parsing fails.

## 4. Security & Compliance Posture
- Mounts config files read-only.
- Resolves security keys dynamically at runtime, avoiding repository source leaks.

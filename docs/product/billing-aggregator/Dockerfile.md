# Component Technical Specification: Dockerfile (Billing Aggregator)

## 1. Purpose & Core Responsibility
- Defines container assembly layers and build instructions for the standalone `billing-aggregator` microservice.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Docker Build Engine.
- **Explicitly Denied Inbound:** 
    - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
    - Package repository networks during APT/npm setups.
- **Explicitly Denied Outbound:** 
    - N/A.

## 3. Function & Method Manifest
- **Build Stages**:
    - **Stage 1**: Loads `node:20` base runtime.
    - **Stage 2**: Installs dynamic building packages (`python3`, `make`, `g++`) to build the native C++ `better-sqlite3` bindings.
    - **Stage 3**: Runs `npm install` and copies remaining sources.

## 4. Security & Compliance Posture
- Cleans apt caches immediately to minimize image sizes and keep the build context surface clean.
- Exposes no outbound container ports.

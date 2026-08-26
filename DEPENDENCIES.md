# ScatterID Extensive Dependency & Installation Reference

This document provides a component-by-component breakdown of all software dependencies, C-library bindings, container images, and runtime requirements for the ScatterID post-quantum identity verification system.

---

## Dependency Hierarchy & Layer Resolution

Dependencies are structured from basic low-level operating system toolchains up to distributed container engines and post-quantum cryptographic libraries.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Microservice & Container Stack (Docker Compose)   │
├─────────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Language Runtimes (Python 3.13, Node 24, Go 1.24) │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Container Engine & Orchestration (Docker Daemon)  │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Base OS Toolchain (gcc, g++, make, cmake, openssl)│
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Group 1: Basic OS & Build Toolchain (Basic Level)

Required for native C/C++ compilation of `liboqs` (Open Quantum Safe C library) and `better-sqlite3` native Node.js bindings.

| Dependency | Minimum Version | Package Name (Ubuntu/Debian) | Purpose |
|---|---|---|---|
| **Bash** | 4.0+ | `bash` | System orchestration scripts (`start.sh`, `test_all.sh`, `check_deps.sh`). |
| **cURL** | 7.68+ | `curl` | REST API health probing and test execution. |
| **Git** | 2.25+ | `git` | Repository version control and sub-module management. |
| **OpenSSL** | 1.1.1+ | `openssl`, `libssl-dev` | TLS key/cert generation (`generate_certs.sh`). |
| **GNU Make** | 4.0+ | `make` | C/C++ native build automation. |
| **GCC & G++** | 9.0+ | `build-essential` | C/C++ compiler toolchain. |
| **CMake** | 3.16+ | `cmake` | Native build generator required for `liboqs`. |

### Installation Command (Debian/Ubuntu)
```bash
sudo apt-get update && sudo apt-get install -y git curl make gcc g++ cmake openssl libssl-dev
```

---

## 2. Group 2: Language Runtimes

Required if running microservices natively outside Docker containers.

| Language / Tool | Recommended Version | Installation Command |
|---|---|---|
| **Python 3** | 3.10+ (3.13 tested) | `sudo apt-get install python3 python3-venv python3-pip` |
| **Node.js** | 20.x+ (24.x tested) | `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| **npm** | 9.0+ | Included with Node.js distribution |
| **Go** | 1.20+ | `sudo apt-get install golang-go` |

---

## 3. Group 3: Container Engine & Orchestration (Required for Full Stack)


| Tool | Minimum Version | Installation Hint |
|---|---|---|
| **Docker Engine** | 24.0+ | `sudo apt-get install docker.io && sudo usermod -aG docker $USER` |
| **Docker Compose** | v2.20+ | `sudo apt-get install docker-compose-plugin` |

---

## 4. Component-Wise Dependency Matrix

### Component 1: Crypto Microservice (`crypto-service`)
- **Base Image**: `python:3.13-slim`
- **System Dependencies**: `git`, `cmake`, `build-essential`, `libssl-dev`
- **Python Libraries**:
  - `liboqs-python` (0.16.0) — NIST FIPS 204 ML-DSA-65 post-quantum signatures
  - `hvac` — HashiCorp Vault REST client
  - `flask` — Microservice REST server over TLS (port 5001)

### Component 2: Verification API Gateway (`verification-api`)
- **Base Image**: `node:24`
- **System Dependencies**: `python3`, `make`, `g++` (for `better-sqlite3` native C++ compilation)
- **Node Modules**:
  - `express` — API Gateway router (port 3000)
  - `better-sqlite3` — High-performance SQLite driver
  - `@hyperledger/fabric-gateway` — gRPC Fabric client
  - `@grpc/grpc-js` — Mutual TLS gRPC transport

- **Base Image**: `node:24`
- **Node Modules**: `express`, `better-sqlite3`
- **Ports**: 3001, 3002, 3003, 3004, 3005

### Component 4: Immutable Audit Ledger (`blockchain`)
- **Docker Images**:
  - `hyperledger/fabric-peer:2.5`
  - `hyperledger/fabric-orderer:2.5`
- **Chaincode**: Go 1.20 (`scatterproof.go`) using `fabric-contract-api-go`

### Component 5: Key Management Service (`vault`)
- **Docker Image**: `hashicorp/vault:latest`
- **Storage**: In-memory KV v2 engine on port 8200

### Component 6: Control Console (`project-dashboard`)
- **Base Image**: `node:24`
- **System Dependencies**: `docker.io` (for log streaming via `/var/run/docker.sock`)
- **Node Modules**: `express`, `better-sqlite3`

---

## 5. Automated Dependency Auditor Script

Run the automated dependency checker to audit your system prior to first deployment:

```bash
./check_deps.sh
```

Sample Audit Output:
```text
Audit Summary: 16 / 16 Checks Passed
SUCCESS: All required system dependencies are satisfied!
You can now run: ./start.sh or ./test_all.sh
```

# Component Technical Specification: test_fault_tolerance.sh

## 1. Purpose & Core Responsibility
- Automates verification of the $k$-of-$n$ Zero-Knowledge Verification reconstruction thresholds ($k=3$, $n=5$).
- Dynamically stops, starts, and heals containerized storage nodes to prove fault tolerance.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Operator manual execution context.
- **Explicitly Denied Inbound:** 
  - External networks.
- **Allowed Outbound (Who this file can talk TO):** 
  - Verification API Gateway (`http://localhost:3000`) via HTTP POST requests.
  - Docker CLI Daemon (for stopping/starting nodes).
- **Explicitly Denied Outbound:** 
  - Unauthenticated network locations.

## 3. Function & Method Manifest
- **Execution Workflow:**
  1. Issues a new test credential.
  2. Verifies the issued credential under nominal conditions (5/5 nodes online).
  3. Stops Shard Node 1 and asserts verification still succeeds (4/5 nodes online).
  4. Stops Shard Node 2 and asserts verification still succeeds (3/5 nodes online).
  5. Stops Shard Node 3 and asserts verification fails (2/5 nodes online, below threshold).
  6. Restarts all stopped containers.
  7. Triggers state synchronization and backfills database contents via the `/heal-shards` routing endpoint.
  8. Confirms verification succeeds after healing is complete.

## 4. Security & Compliance Posture
- Fulfills the Phase 2 Definition of Done by proving fault-tolerant reconstruction boundaries programmatically.

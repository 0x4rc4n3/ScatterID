# Containerized SQLite Storage Node Microservice

Each `shard-node` instance runs in a separate, physically isolated Docker container (`scatterid-shard-1` .. `scatterid-shard-5`) managing its own independent volume (`shard_1_data` .. `shard_5_data`).

---

## 🔐 Inter-Service Protocol & Security

1. **Bearer Token Authentication**:
   - Environment Variable: `SHARD_NODE_API_KEY`
   - Every incoming request to protected routes (`POST /shard`, `GET /shard/:credentialId`, `POST /update-status`, `GET /integrity`) requires `Authorization: Bearer <SHARD_NODE_API_KEY>`.
   - Unauthorized requests return `401 Unauthorized` or `403 Forbidden`.

2. **Isolated Database Schema**:
   - `node_X.db` is stored inside `/app/data/node_X.db`.
   - Table `shard_references` stores `(id, credential_id, share_index, share_value, share_hash, share_checksum)`.
   - Table `credentials` stores metadata associated with the credential claims.

---

## 📡 Microservice Routes

- `GET /health`: Health probe reporting node ID, share count, database byte size, and status.
- `POST /shard`: Ingests and persists a single Shamir secret share ($1 \le \text{index} \le 5$).
- `GET /shard/:credentialId`: Retrieves the stored share for the given credential ID.
- `POST /update-status`: Updates the credential status or Fabric transaction anchor ID.
- `GET /integrity`: Evaluates SHA3-256 hashes of all stored shares to verify database integrity.

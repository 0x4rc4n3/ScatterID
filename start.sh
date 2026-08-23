#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "=========================================================="
echo "   ScatterID System Startup & Orchestration Manager     "
echo "=========================================================="

# 1. Verify Docker Daemon is accessible
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running or accessible. Please start Docker and try again."
    exit 1
fi
echo "[+] Docker daemon is active."

# 2. Generate TLS Certificates if missing
if [ ! -f "components/crypto/certs/crypto-service.crt" ] || [ ! -f "components/crypto/certs/ca.crt" ]; then
    echo "[+] Generating internal TLS certificates..."
    bash components/crypto/certs/generate_certs.sh
else
    echo "[+] TLS certificates present."
fi

# 3. Start Fabric Blockchain Network if not running
if ! docker ps --format "{{.Names}}" | grep -q "peer0.issuer.scatterid.com"; then
    echo "[+] Initializing Hyperledger Fabric network (orderer & peers)..."
    (cd components/blockchain/fabric-network && ./start.sh)
else
    echo "[+] Hyperledger Fabric network is active."
fi

# 3.5. Configure AppRole inside Vault
echo "[+] Hardening KMS Vault (Configuring AppRole and access policy)..."
for i in {1..15}; do
    if docker exec vault.scatterid.com vault status -address=http://127.0.0.1:8200 >/dev/null 2>&1; then
        break
    fi
    echo "    Waiting for Vault container to start..."
    sleep 2
done

# Enable approle auth
docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=scatterid-vault-root-token vault.scatterid.com vault auth enable approle 2>/dev/null || true

# Write custom security policy from file
docker exec -i -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=scatterid-vault-root-token vault.scatterid.com vault policy write issuer-policy - < components/crypto/crypto-service/vault/policies/issuer-policy.hcl >/dev/null

# Create/configure role
docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=scatterid-vault-root-token vault.scatterid.com vault write auth/approle/role/issuer-role token_policies="issuer-policy" token_ttl=1h token_max_ttl=4h >/dev/null

# Retrieve AppRole Credentials dynamically
export VAULT_ROLE_ID=$(docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=scatterid-vault-root-token vault.scatterid.com vault read -field=role_id auth/approle/role/issuer-role/role-id)
export VAULT_SECRET_ID=$(docker exec -e VAULT_ADDR=http://127.0.0.1:8200 -e VAULT_TOKEN=scatterid-vault-root-token vault.scatterid.com vault write -f -field=secret_id auth/approle/role/issuer-role/secret-id)
export VAULT_SECRET_PATH="scatterid/mldsa"

# 4. Bring up Docker Compose Microservice Stack
echo "[+] Starting ScatterID microservice stack (Vault, Crypto, Verification, Dashboard)..."
docker compose up -d

# 5. Connect Fabric nodes to Compose network for dashboard TCP visibility
NET_NAME=$(docker network ls --format "{{.Name}}" | grep "scatterid_net" | head -n 1)
if [ -n "$NET_NAME" ]; then
    echo "[+] Synchronizing network bridges ($NET_NAME)..."
    docker network connect "$NET_NAME" orderer.scatterid.com 2>/dev/null || true
    docker network connect "$NET_NAME" peer0.issuer.scatterid.com 2>/dev/null || true
    docker network connect "$NET_NAME" peer0.verifier.scatterid.com 2>/dev/null || true
fi

# 6. Synchronize container application layers
echo "[+] Synchronizing container application layers..."
docker compose restart verification-api project-dashboard >/dev/null 2>&1 || true

# 7. Perform live health probe
echo "[+] Performing multi-point health check..."
sleep 2

CRYPTO_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" https://localhost:5001/package || echo "000")
VERIFY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/status/health || echo "000")
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/status || echo "000")

echo ""
echo "=========================================================="
echo "   ScatterID Stack Ready & Operational!                 "
echo "=========================================================="
echo "  - Control Dashboard:    http://localhost:4000"
echo "  - Verification Gateway: http://localhost:3000"
echo "  - Crypto Microservice:  https://localhost:5001"
echo "  - HashiCorp Vault:      http://localhost:8200"
echo "=========================================================="
echo "  Service Probe Results:"
echo "    Crypto Service (HTTPS:5001):   HTTP $CRYPTO_STATUS (Auth Enforced)"
echo "    Verification API (HTTP:3000):  HTTP $VERIFY_STATUS (Gateway Ready)"
echo "    Dashboard Console (HTTP:4000): HTTP $DASHBOARD_STATUS (Active)"
echo "=========================================================="

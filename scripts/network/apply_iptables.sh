#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Network Microsegmentation & Firewall Policy Enforcer
# Document ID: SEC-NET-07 / Master Blueprint: start.md
# ==============================================================================
# Partitions the network into 3 isolated zones:
#   Zone 1: Counter / Help Desk VPN (10.20.0.0/24) -> Permitted: :5000 (Client Portal)
#                                                  -> Denied: :8080, :3000, :5001, :7050-9051
#   Zone 2: Management Ops (10.10.0.0/24)          -> Permitted: :8080 (Ops Dashboard), :3000 (Gateway API)
#   Zone 3: Core Dataplane (127.0.0.1 / Docker)     -> Internal microservices only
# ==============================================================================

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
ACTION="${1:-apply}"

COUNTER_VPN_SUBNET="10.20.0.0/24"
MGMT_LAN_SUBNET="10.10.0.0/24"
OPS_DASHBOARD_PORT="8080"
CLIENT_PORTAL_PORT="5000"
CRYPTO_SERVICE_PORT="5001"
VERIFICATION_API_PORT="3000"

run_cmd() {
  if [ "$DRY_RUN" = "1" ] || [ "${DRY_RUN}" = "true" ]; then
    echo "[DRY-RUN] $*"
  else
    echo "[FIREWALL] $*"
    "$@"
  fi
}

check_root() {
  if [ "$DRY_RUN" != "1" ] && [ "${DRY_RUN}" != "true" ] && [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: iptables requires root privileges. Run with sudo or DRY_RUN=1." >&2
    exit 1
  fi
}

apply_rules() {
  echo "=== Applying ScatterID Network Microsegmentation Rules ==="

  # 1. Ensure loopback and established states
  run_cmd iptables -A INPUT -i lo -j ACCEPT
  run_cmd iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

  # 2. Zone 1: Counter VPN (10.20.0.0/24) ACLs
  # Strictly drop Counter VPN access to Ops Dashboard (:8080)
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$OPS_DASHBOARD_PORT" \
    -m limit --limit 5/min -j LOG --log-prefix "[SCATTERID_DROP_OPS]: " || true
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$OPS_DASHBOARD_PORT" -j DROP

  # Strictly drop Counter VPN access to Verification Gateway API (:3000)
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$VERIFICATION_API_PORT" -j DROP

  # Strictly drop Counter VPN access to Crypto Service (:5001)
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$CRYPTO_SERVICE_PORT" -j DROP

  # Strictly drop Counter VPN access to Hyperledger Fabric ports (7050:9051)
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport 7050:9051 -j DROP

  # Allow Counter VPN access ONLY to Client Portal HTTP/HTTPS (:5000)
  run_cmd iptables -A INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$CLIENT_PORTAL_PORT" -j ACCEPT

  # Drop all other cross-zone probe traffic from Counter VPN to Management Zone
  run_cmd iptables -A FORWARD -s "$COUNTER_VPN_SUBNET" -d "$MGMT_LAN_SUBNET" -j DROP

  # 3. Zone 2: Management Subnet (10.10.0.0/24) ACLs
  # Allow Management Ops to Ops Dashboard (:8080)
  run_cmd iptables -A INPUT -s "$MGMT_LAN_SUBNET" -p tcp --dport "$OPS_DASHBOARD_PORT" -j ACCEPT

  # Allow Management Ops to Verification API (:3000) for admin operations
  run_cmd iptables -A INPUT -s "$MGMT_LAN_SUBNET" -p tcp --dport "$VERIFICATION_API_PORT" -j ACCEPT

  # 4. Core Dataplane Isolation
  # Reject external access to internal crypto-service (:5001) without localhost or mTLS bridge
  run_cmd iptables -A INPUT ! -s 127.0.0.1 -p tcp --dport "$CRYPTO_SERVICE_PORT" -j DROP || true

  echo "=== ScatterID Firewall Rules Applied Successfully ==="
}

flush_rules() {
  echo "=== Flushing ScatterID Firewall Rules ==="
  run_cmd iptables -D INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$OPS_DASHBOARD_PORT" -j DROP || true
  run_cmd iptables -D INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$VERIFICATION_API_PORT" -j DROP || true
  run_cmd iptables -D INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$CRYPTO_SERVICE_PORT" -j DROP || true
  run_cmd iptables -D INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport 7050:9051 -j DROP || true
  run_cmd iptables -D INPUT -s "$COUNTER_VPN_SUBNET" -p tcp --dport "$CLIENT_PORTAL_PORT" -j ACCEPT || true
  run_cmd iptables -D INPUT -s "$MGMT_LAN_SUBNET" -p tcp --dport "$OPS_DASHBOARD_PORT" -j ACCEPT || true
  run_cmd iptables -D INPUT -s "$MGMT_LAN_SUBNET" -p tcp --dport "$VERIFICATION_API_PORT" -j ACCEPT || true
  run_cmd iptables -D FORWARD -s "$COUNTER_VPN_SUBNET" -d "$MGMT_LAN_SUBNET" -j DROP || true
  echo "=== Flush Complete ==="
}

check_root

case "$ACTION" in
  apply)
    apply_rules
    ;;
  flush)
    flush_rules
    ;;
  test)
    DRY_RUN=1 apply_rules
    ;;
  *)
    echo "Usage: $0 [apply|flush|test]"
    exit 1
    ;;
esac

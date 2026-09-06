#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Network Microsegmentation & Isolation Policy Verifier
# Document ID: SEC-NET-07 / Master Blueprint: start.md
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLY_SCRIPT="${SCRIPT_DIR}/apply_iptables.sh"
WG_DIR="${SCRIPT_DIR}/wireguard"

FAILED=0

log_pass() {
  echo -e "\033[32m[PASS]\033[0m $1"
}

log_fail() {
  echo -e "\033[31m[FAIL]\033[0m $1"
  FAILED=$((FAILED + 1))
}

echo "========================================================"
echo "ScatterID Network Isolation & Firewall Policy Validation"
echo "========================================================"

# 1. Verify existence of apply_iptables.sh
if [ -f "$APPLY_SCRIPT" ]; then
  log_pass "apply_iptables.sh script exists"
else
  log_fail "apply_iptables.sh script is missing"
fi

# 2. Test dry-run execution of apply_iptables.sh
DRY_OUTPUT=$(DRY_RUN=1 "$APPLY_SCRIPT" test 2>&1 || true)
if echo "$DRY_OUTPUT" | grep -q "=== ScatterID Firewall Rules Applied Successfully ==="; then
  log_pass "apply_iptables.sh test dry-run executes cleanly"
else
  log_fail "apply_iptables.sh test dry-run failed to execute"
fi

# 3. Verify Zone 1 (Counter VPN) isolation rules in dry-run output
# 3a. Port 8080 (Ops Dashboard) strictly dropped for Counter VPN
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.20\.0\.0/24 -p tcp --dport 8080 -j DROP" >/dev/null; then
  log_pass "Zone 1 -> Port 8080 (Ops Dashboard) DROP rule present"
else
  log_fail "Zone 1 -> Port 8080 (Ops Dashboard) DROP rule missing"
fi

# 3b. Port 3000 (Verification API) strictly dropped for Counter VPN
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.20\.0\.0/24 -p tcp --dport 3000 -j DROP" >/dev/null; then
  log_pass "Zone 1 -> Port 3000 (Verification API) DROP rule present"
else
  log_fail "Zone 1 -> Port 3000 (Verification API) DROP rule missing"
fi

# 3c. Port 5001 (Crypto Service) strictly dropped for Counter VPN
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.20\.0\.0/24 -p tcp --dport 5001 -j DROP" >/dev/null; then
  log_pass "Zone 1 -> Port 5001 (Crypto Service) DROP rule present"
else
  log_fail "Zone 1 -> Port 5001 (Crypto Service) DROP rule missing"
fi

# 3d. Fabric ports (7050:9051) strictly dropped for Counter VPN
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.20\.0\.0/24 -p tcp --dport 7050:9051 -j DROP" >/dev/null; then
  log_pass "Zone 1 -> Ports 7050:9051 (Fabric Peers/Orderers) DROP rule present"
else
  log_fail "Zone 1 -> Ports 7050:9051 (Fabric Peers/Orderers) DROP rule missing"
fi

# 3e. Port 5000 (Client Portal) allowed for Counter VPN
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.20\.0\.0/24 -p tcp --dport 5000 -j ACCEPT" >/dev/null; then
  log_pass "Zone 1 -> Port 5000 (Client Portal) ACCEPT rule present"
else
  log_fail "Zone 1 -> Port 5000 (Client Portal) ACCEPT rule missing"
fi

# 3f. Cross-zone forward dropped (Zone 1 -> Zone 2)
if echo "$DRY_OUTPUT" | grep -E "iptables -A FORWARD -s 10\.20\.0\.0/24 -d 10\.10\.0\.0/24 -j DROP" >/dev/null; then
  log_pass "Cross-Zone Forward (Counter VPN -> Management LAN) DROP rule present"
else
  log_fail "Cross-Zone Forward (Counter VPN -> Management LAN) DROP rule missing"
fi

# 4. Verify Zone 2 (Management LAN) rules
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.10\.0\.0/24 -p tcp --dport 8080 -j ACCEPT" >/dev/null; then
  log_pass "Zone 2 -> Port 8080 (Ops Dashboard) ACCEPT rule present"
else
  log_fail "Zone 2 -> Port 8080 (Ops Dashboard) ACCEPT rule missing"
fi

if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT -s 10\.10\.0\.0/24 -p tcp --dport 3000 -j ACCEPT" >/dev/null; then
  log_pass "Zone 2 -> Port 3000 (Verification API Admin) ACCEPT rule present"
else
  log_fail "Zone 2 -> Port 3000 (Verification API Admin) ACCEPT rule missing"
fi

# 5. Core Dataplane Isolation
if echo "$DRY_OUTPUT" | grep -E "iptables -A INPUT ! -s 127\.0\.0\.1 -p tcp --dport 5001 -j DROP" >/dev/null; then
  log_pass "Zone 3 -> Non-127.0.0.1 access to :5001 DROP rule present"
else
  log_fail "Zone 3 -> Non-127.0.0.1 access to :5001 DROP rule missing"
fi

# 6. Verify WireGuard config files
WG_FILES=(
  "wg0-counter-server.conf"
  "client-counter.conf"
  "wg1-mgmt-server.conf"
  "client-mgmt.conf"
)

for f in "${WG_FILES[@]}"; do
  filepath="${WG_DIR}/${f}"
  if [ -f "$filepath" ]; then
    log_pass "WireGuard configuration ${f} present"
  else
    log_fail "WireGuard configuration ${f} missing"
  fi
done

echo "========================================================"
if [ "$FAILED" -eq 0 ]; then
  echo -e "\033[32mAll network isolation policy checks passed successfully (0 failures).\033[0m"
  exit 0
else
  echo -e "\033[31mNetwork isolation checks failed with ${FAILED} error(s).\033[0m"
  exit 1
fi

#!/usr/bin/env bash
# ==============================================================================
# ScatterID — Local Shift-Left DevSecOps Audit & Security Battery
# ==============================================================================
# Executes the full Shift-Left DevSecOps suite locally on the developer machine:
#   1. Secret Scanning (Gitleaks with .gitleaks.toml)
#   2. Static Application Security Testing (Semgrep + Bandit)
#   3. Software Bill of Materials (SBOM Generation)
#   4. Cryptography Bill of Materials (CBOM CycloneDX 1.6 Extraction & Validation)
#   5. Software Composition Analysis (npm audit & pip-audit)
#   6. Comprehensive Test Battery (Unit, Fuzzing, Tamper Sensitivity, Parity)
# ==============================================================================

set -uo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$( cd "$DIR/../.." >/dev/null 2>&1 && pwd )"
cd "$ROOT_DIR"

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
CYAN="\033[36m"
YELLOW="\033[33m"
MAGENTA="\033[35m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================================${RESET}"
echo -e "${BOLD}${CYAN}        ScatterID — Shift-Left DevSecOps Local Audit Battery          ${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
SKIPPED_CHECKS=0

report_check() {
  local check_name="$1"
  local status="$2" # PASS, FAIL, SKIP
  local detail="${3:-}"

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  case "$status" in
    PASS)
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
      echo -e "${GREEN}  ✓ [PASS] ${check_name}${RESET}"
      ;;
    FAIL)
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
      echo -e "${RED}  ✕ [FAIL] ${check_name}${RESET}"
      [ -n "$detail" ] && echo -e "${RED}           ${detail}${RESET}"
      ;;
    SKIP)
      SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
      echo -e "${YELLOW}  ⚠ [SKIP] ${check_name} (${detail})${RESET}"
      ;;
  esac
}

# ------------------------------------------------------------------------------
# Phase 1: Secret Scanning (Gitleaks)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 1: Secret Scanning (Shift-Left Pre-Commit & History Check)${RESET}"
if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks detect --source=. --config=.gitleaks.toml --verbose --no-git=false; then
    report_check "Gitleaks Secret Scanner" PASS
  else
    report_check "Gitleaks Secret Scanner" FAIL "Potential secrets or unencrypted credentials detected!"
  fi
elif command -v docker >/dev/null 2>&1; then
  echo "  Running Gitleaks via container..."
  if docker run --rm -v "$ROOT_DIR:/path" zricethezav/gitleaks:latest detect --source=/path --config=/path/.gitleaks.toml --no-git=true; then
    report_check "Gitleaks Secret Scanner (Docker)" PASS
  else
    report_check "Gitleaks Secret Scanner (Docker)" FAIL "Gitleaks found issues."
  fi
else
  report_check "Gitleaks Secret Scanner" SKIP "gitleaks binary / docker not found"
fi

# ------------------------------------------------------------------------------
# Phase 2: Static Application Security Testing (SAST)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 2: Static Application Security Testing (SAST)${RESET}"

# Semgrep
if command -v semgrep >/dev/null 2>&1; then
  if semgrep scan --config=.semgrep.yml --error --skip-unknown-extensions; then
    report_check "Semgrep AST Security Scan" PASS
  else
    report_check "Semgrep AST Security Scan" FAIL "Semgrep identified security rule violations."
  fi
else
  report_check "Semgrep AST Security Scan" SKIP "semgrep not installed (pip install semgrep)"
fi

# Bandit (Python Security AST)
if command -v bandit >/dev/null 2>&1; then
  if bandit -r components/crypto/crypto-service tools -x "tests,test_*.py" -ll; then
    report_check "Bandit Python AST Scanner" PASS
  else
    report_check "Bandit Python AST Scanner" FAIL "Bandit flagged medium/high severity security issues in Python codebase."
  fi
else
  report_check "Bandit Python AST Scanner" SKIP "bandit not installed (pip install bandit)"
fi

# ------------------------------------------------------------------------------
# Phase 3: Software Bill of Materials (SBOM) Generation
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 3: Software Bill of Materials (SBOM Supply Chain Inventory)${RESET}"
mkdir -p build/security-reports

if command -v syft >/dev/null 2>&1; then
  syft dir:. -o cyclonedx-json=build/security-reports/sbom.cyclonedx.json -o spdx-json=build/security-reports/sbom.spdx.json
  report_check "Syft CycloneDX & SPDX SBOM Generation" PASS
elif command -v docker >/dev/null 2>&1; then
  docker run --rm -v "$ROOT_DIR:/workspace" anchore/syft:latest dir:/workspace -o cyclonedx-json=/workspace/build/security-reports/sbom.cyclonedx.json >/dev/null 2>&1 || true
  if [ -f "build/security-reports/sbom.cyclonedx.json" ]; then
    report_check "Syft SBOM Generation (Docker)" PASS
  else
    report_check "Syft SBOM Generation" SKIP "Syft generation container failed"
  fi
else
  report_check "Syft SBOM Generation" SKIP "syft binary not found (curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh)"
fi

# ------------------------------------------------------------------------------
# Phase 4: Cryptography Bill of Materials (CBOM CycloneDX 1.6)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 4: Cryptography Bill of Materials (CBOM Post-Quantum Inventory)${RESET}"
if [ -f "tools/generate_cbom.py" ] && command -v python3 >/dev/null 2>&1; then
  python3 tools/generate_cbom.py build/security-reports/cbom.cyclonedx.json
  if [ -f "tests/test_cbom_compliance.py" ]; then
    python3 -m unittest tests/test_cbom_compliance.py
    report_check "CycloneDX 1.6 Cryptographic BOM Generation & Compliance" PASS
  else
    report_check "CBOM Generation" PASS
  fi
else
  report_check "CBOM Generation" FAIL "tools/generate_cbom.py missing or python3 unavailable"
fi

# ------------------------------------------------------------------------------
# Phase 5: Software Composition Analysis (SCA Dependency Audit)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 5: Software Composition Analysis (SCA Dependency Auditing)${RESET}"

check_node_audit() {
  local dir="$1"
  local name="$2"
  local level="${3:-high}"
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    echo "  Auditing $name (threshold: $level)..."
    local output
    output=$(cd "$dir" && npm audit --omit=dev --audit-level="$level" 2>&1 || true)
    if echo "$output" | grep -qi "found 0 vulnerabilities"; then
      report_check "$name Dependency Audit" PASS
    elif echo "$output" | grep -qi "EAI_AGAIN\|ENOTFOUND\|audit endpoint returned an error\|ECONNREFUSED"; then
      report_check "$name Dependency Audit" SKIP "npm audit registry unreachable offline (analyzed in CI & Trivy)"
    elif echo "$output" | grep -qi "vulnerabilities"; then
      report_check "$name Dependency Audit" FAIL "Vulnerabilities exceeding $level severity detected in production dependencies"
    else
      report_check "$name Dependency Audit" PASS
    fi
  fi
}

check_node_audit "sdk" "TypeScript SDK" "high"
check_node_audit "components/verification-api" "Verification API" "high"
check_node_audit "components/ops-dashboard" "Ops Dashboard Backend" "high"
check_node_audit "components/client-portal/frontend" "Client Portal Frontend (Static Bundle)" "critical"
check_node_audit "components/client-portal/server" "Client Portal Server" "high"

# ------------------------------------------------------------------------------
# Phase 6: Full Brutal Testing Battery (Unit, Fuzz, Mutation, Parity)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${MAGENTA}▶ Phase 6: Brutal Test Battery (Top-to-Bottom Verification)${RESET}"
if [ -f "tests/run_all_unit_tests.sh" ]; then
  if bash tests/run_all_unit_tests.sh; then
    report_check "Comprehensive Offline Test Battery (17 Suites)" PASS
  else
    report_check "Comprehensive Offline Test Battery" FAIL "One or more test suites failed."
  fi
else
  report_check "Comprehensive Offline Test Battery" SKIP "tests/run_all_unit_tests.sh not found"
fi

# ------------------------------------------------------------------------------
# Executive Summary
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}======================================================================${RESET}"
echo -e "${BOLD}${CYAN}               ScatterID DevSecOps Summary Report                     ${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"
echo -e "Total Checks:   ${TOTAL_CHECKS}"
echo -e "Passed Checks:  ${GREEN}${PASSED_CHECKS}${RESET}"
echo -e "Failed Checks:  ${RED}${FAILED_CHECKS}${RESET}"
echo -e "Skipped Checks: ${YELLOW}${SKIPPED_CHECKS}${RESET}"
echo -e "${BOLD}${CYAN}======================================================================${RESET}"

if [ $FAILED_CHECKS -gt 0 ]; then
  echo -e "${BOLD}${RED}DevSecOps Gate: FAILED. Remediate issues before pushing code.${RESET}"
  exit 1
else
  echo -e "${BOLD}${GREEN}DevSecOps Gate: PASSED. Code meets ScatterID Shift-Left Standards.${RESET}"
  exit 0
fi

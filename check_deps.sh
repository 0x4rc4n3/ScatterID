#!/usr/bin/env bash
set -e

# Terminal Color Definitions
BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

AUTO_INSTALL=false
if [ "$1" == "--install" ] || [ "$1" == "-i" ]; then
    AUTO_INSTALL=true
fi

echo -e "${BOLD}${CYAN}==========================================================${RESET}"
echo -e "${BOLD}${CYAN}   ScatterID Component-Wise Dependency Audit & Setup     ${RESET}"
echo -e "${BOLD}${CYAN}==========================================================${RESET}"
echo ""

TOTAL_CHECKS=0
PASSED_CHECKS=0
MISSING_DEPS=()
MISSING_PACKAGES=()

check_tool() {
    local name="$1"
    local cmd="$2"
    local group="$3"
    local pkg_name="$4"
    local install_hint="$5"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if command -v "$cmd" >/dev/null 2>&1; then
        local version
        version=$($cmd --version 2>&1 | head -n 1 | cut -c1-60 || echo "installed")
        echo -e "  [${GREEN}PASS${RESET}] ${BOLD}$name${RESET} -> $version"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "  [${RED}FAIL${RESET}] ${BOLD}$name${RESET} -> NOT FOUND"
        MISSING_DEPS+=("$group: $name (Fix: $install_hint)")
        if [ -n "$pkg_name" ]; then
            MISSING_PACKAGES+=("$pkg_name")
        fi
    fi
}

check_tool_version_cmd() {
    local name="$1"
    local cmd="$2"
    local ver_flag="$3"
    local group="$4"
    local pkg_name="$5"
    local install_hint="$6"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if command -v "$cmd" >/dev/null 2>&1; then
        local version
        version=$($cmd $ver_flag 2>&1 | head -n 1 | cut -c1-60 || echo "installed")
        echo -e "  [${GREEN}PASS${RESET}] ${BOLD}$name${RESET} -> $version"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "  [${RED}FAIL${RESET}] ${BOLD}$name${RESET} -> NOT FOUND"
        MISSING_DEPS+=("$group: $name (Fix: $install_hint)")
        if [ -n "$pkg_name" ]; then
            MISSING_PACKAGES+=("$pkg_name")
        fi
    fi
}

# -------------------------------------------------------------
# GROUP 1: Basic OS & C/C++ Build Toolchain (Bottom / Basic Level)
# -------------------------------------------------------------
echo -e "${BOLD}${YELLOW}--- Group 1: Basic OS & C/C++ Build Toolchain ---${RESET}"
check_tool "Bash Shell" "bash" "Group 1" "bash" "Standard on Linux/macOS"
check_tool "cURL HTTP Client" "curl" "Group 1" "curl" "sudo apt-get install curl"
check_tool "Git Version Control" "git" "Group 1" "git" "sudo apt-get install git"
check_tool "OpenSSL" "openssl" "Group 1" "openssl" "sudo apt-get install openssl"
check_tool "GNU Make" "make" "Group 1" "make" "sudo apt-get install make"
check_tool "GCC C Compiler" "gcc" "Group 1" "build-essential" "sudo apt-get install build-essential"
check_tool "G++ C++ Compiler" "g++" "Group 1" "build-essential" "sudo apt-get install build-essential"
check_tool "CMake (for liboqs)" "cmake" "Group 1" "cmake" "sudo apt-get install cmake"
echo ""

# -------------------------------------------------------------
# GROUP 2: High-Level Language Runtimes
# -------------------------------------------------------------
echo -e "${BOLD}${YELLOW}--- Group 2: Language Runtimes (Python, Node.js, Go) ---${RESET}"
check_tool "Python 3 Runtime" "python3" "Group 2" "python3" "sudo apt-get install python3 python3-venv python3-pip"
check_tool "Node.js (v20+ Recommended)" "node" "Group 2" "nodejs" "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs"
check_tool "npm Package Manager" "npm" "Group 2" "npm" "Included with Node.js"
check_tool_version_cmd "Go Language (for Chaincode)" "go" "version" "Group 2" "golang-go" "sudo apt-get install golang-go"
echo ""

# -------------------------------------------------------------
# GROUP 3: Container Engine & Orchestration
# -------------------------------------------------------------
echo -e "${BOLD}${YELLOW}--- Group 3: Container Orchestration (Docker Engine) ---${RESET}"
check_tool "Docker Daemon" "docker" "Group 3" "docker.io" "sudo apt-get install docker.io && sudo usermod -aG docker $USER"

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if docker compose version >/dev/null 2>&1 || docker-compose --version >/dev/null 2>&1; then
    echo -e "  [${GREEN}PASS${RESET}] ${BOLD}Docker Compose (v2+)${RESET}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "  [${RED}FAIL${RESET}] ${BOLD}Docker Compose (v2+)${RESET} -> NOT FOUND"
    MISSING_DEPS+=("Group 3: Docker Compose (Fix: sudo apt-get install docker-compose-plugin)")
    MISSING_PACKAGES+=("docker-compose-plugin")
fi
echo ""

# -------------------------------------------------------------
# GROUP 4: Component 1 — Post-Quantum Crypto Service
# -------------------------------------------------------------
echo -e "${BOLD}${YELLOW}--- Group 4: Component 1 (Crypto Microservice & PQC Module) ---${RESET}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if python3 -c "import ssl, oqs" >/dev/null 2>&1; then
    echo -e "  [${GREEN}PASS${RESET}] ${BOLD}Python PQC Bindings (liboqs-python & OpenSSL)${RESET}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "  [${YELLOW}WARN${RESET}] ${BOLD}Python PQC Bindings${RESET} -> Baked into Docker container layer automatically."
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# -------------------------------------------------------------
# GROUP 5: Component 2 & 5 — Gateway & Dashboard Node Stack
# -------------------------------------------------------------
echo -e "${BOLD}${YELLOW}--- Group 5: Component 2 & 5 (Gateway & Dashboard) ---${RESET}"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [ -d "components/verification-api/node_modules" ] || [ -d "components/project-dashboard/node_modules" ]; then
    echo -e "  [${GREEN}PASS${RESET}] ${BOLD}Node.js Dependency Tree (express, better-sqlite3)${RESET}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "  [${YELLOW}INFO${RESET}] ${BOLD}Node.js Dependencies${RESET} -> Compiled inside Docker images during build."
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi
echo ""

# -------------------------------------------------------------
# Summary & Auto-Installation Remediation
# -------------------------------------------------------------
echo -e "${BOLD}${CYAN}==========================================================${RESET}"
echo -e "${BOLD}Audit Summary:${RESET} ${GREEN}${PASSED_CHECKS}${RESET} / ${BOLD}${TOTAL_CHECKS}${RESET} Checks Passed"
echo -e "${BOLD}${CYAN}==========================================================${RESET}"

if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}SUCCESS: All required system dependencies are satisfied!${RESET}"
    echo -e "You can now run: ${CYAN}./quickstart.sh${RESET} or ${CYAN}./test_all.sh${RESET}"
else
    echo -e "${RED}${BOLD}ATTENTION: Missing dependencies detected:${RESET}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "  - $dep"
    done
    echo ""

    if [ "$AUTO_INSTALL" = true ]; then
        echo -e "${BOLD}${YELLOW}Auto-installing missing packages...${RESET}"
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y "${MISSING_PACKAGES[@]}"
            echo -e "${GREEN}${BOLD}Packages installed successfully! Re-running check...${RESET}"
            exec "$0"
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y "${MISSING_PACKAGES[@]}"
        elif command -v brew >/dev/null 2>&1; then
            brew install "${MISSING_PACKAGES[@]}"
        else
            echo -e "${RED}Package manager not automatically recognized. Please install manually.${RESET}"
        fi
    else
        echo -e "${YELLOW}To automatically install missing dependencies, run:${RESET}"
        echo -e "  ${CYAN}./check_deps.sh --install${RESET}"
        echo ""
        echo -e "${YELLOW}Manual Installation Command (Ubuntu / Debian):${RESET}"
        echo -e "${CYAN}sudo apt-get update && sudo apt-get install -y ${MISSING_PACKAGES[*]}${RESET}"
    fi
fi
echo ""

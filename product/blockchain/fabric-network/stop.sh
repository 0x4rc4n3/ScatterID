#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Stopping Custom ScatterID Fabric Network ==="
docker compose down -v

# Clean up channel block and package if requested, or just leave them
echo "Network stopped and container volumes pruned."

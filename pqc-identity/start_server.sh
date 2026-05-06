#!/bin/bash
# Startup script for KFUEIT PQC-DID Identity Server

# Determine the directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting KFUEIT PQC-DID Production Server ==="

# Set liboqs library path if needed
export LD_LIBRARY_PATH="/home/arcane/pqc-lms-project/liboqs/install/usr/local/lib:$LD_LIBRARY_PATH"

# Run Gunicorn
echo "[PQC] Binding WSGI Server on 0.0.0.0:8080..."
exec python3 -m gunicorn --workers 3 --limit-request-line 16384 --bind 0.0.0.0:8080 wsgi:app

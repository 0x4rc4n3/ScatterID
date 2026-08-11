#!/bin/bash
set -e

# Set working directory to the directory containing this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Generating Root CA..."
# Generate CA key and certificate
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout ca.key \
  -out ca.crt \
  -days 365 \
  -subj "/CN=ScatterID Internal Root CA/O=ScatterID"

echo "Generating Server Key..."
# Generate Server Key
openssl genrsa -out crypto-service.key 2048

# Create CSR configuration for SAN (Subject Alternative Name)
cat <<EOF > server.ext
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = crypto-service
IP.1 = 127.0.0.1
EOF

echo "Generating CSR..."
# Generate CSR
openssl req -new -key crypto-service.key \
  -out crypto-service.csr \
  -subj "/CN=localhost/O=ScatterID"

echo "Signing Server Certificate with Root CA..."
# Sign CSR with CA
openssl x509 -req -in crypto-service.csr \
  -CA ca.crt \
  -CAkey ca.key \
  -CAcreateserial \
  -out crypto-service.crt \
  -days 365 \
  -sha256 \
  -extfile server.ext

# Create full certificate chain bundle for server TLS handshake
cat crypto-service.crt ca.crt > bundle.crt

# Clean up CSR and configuration
rm -f crypto-service.csr server.ext
echo "Certificates generated successfully in $DIR"
chmod 600 ca.key crypto-service.key 2>/dev/null || true
chmod 644 ca.crt crypto-service.crt bundle.crt 2>/dev/null || true

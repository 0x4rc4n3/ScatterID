#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=== Starting Custom ScatterID Fabric Network ==="

# Define paths
FABRIC_BIN="./fabric-samples/bin"
FABRIC_CFG_PATH="$DIR/fabric-samples/config/"
export FABRIC_CFG_PATH

# 1. Generate crypto material if organizations folder doesn't exist
if [ ! -d "organizations/peerOrganizations" ]; then
    echo "Generating cryptographic certificates..."
    $FABRIC_BIN/cryptogen generate --config=cryptogen.yaml --output=organizations
else
    echo "Certificates already exist."
fi

# 2. Generate Genesis Block if it doesn't exist
if [ ! -f "channel-artifacts/scatterid-channel.block" ]; then
    echo "Generating channel genesis block..."
    mkdir -p channel-artifacts
    FABRIC_CFG_PATH="$DIR" $FABRIC_BIN/configtxgen -profile TwoOrgsApplicationGenesis -outputBlock channel-artifacts/scatterid-channel.block -channelID scatterid-channel
else
    echo "Genesis block already exists."
fi

# 3. Start the containers
echo "Starting Docker containers..."
docker compose up -d

# Wait for orderer to start
echo "Waiting for orderer node to initialize..."
sleep 15


# 4. Join orderer to the channel (allow failure if already joined)
echo "Joining orderer to channel..."
export ORDERER_CA="$DIR/organizations/ordererOrganizations/scatterid.com/orderers/orderer.scatterid.com/tls/ca.crt"
export ORDERER_ADMIN_CERT="$DIR/organizations/ordererOrganizations/scatterid.com/orderers/orderer.scatterid.com/tls/server.crt"
export ORDERER_ADMIN_KEY="$DIR/organizations/ordererOrganizations/scatterid.com/orderers/orderer.scatterid.com/tls/server.key"

set +e
$FABRIC_BIN/osnadmin channel join --channelID scatterid-channel --config-block channel-artifacts/scatterid-channel.block -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_CERT" --client-key "$ORDERER_ADMIN_KEY"
OSN_RES=$?
set -e

if [ $OSN_RES -eq 0 ]; then
    echo "Orderer joined channel successfully."
    echo "Sleeping 10s to let Raft leader election complete..."
    sleep 10
else
    echo "Orderer join command exited (might already be joined)."
fi


# 5. Join peers to channel (allow failure if already joined)
echo "Joining peer0.issuer.scatterid.com to channel..."
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=IssuerMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/issuer.scatterid.com/peers/peer0.issuer.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/issuer.scatterid.com/users/Admin@issuer.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

set +e
$FABRIC_BIN/peer channel join -b channel-artifacts/scatterid-channel.block
echo "Joining peer0.verifier.scatterid.com to channel..."
export CORE_PEER_LOCALMSPID=VerifierMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/verifier.scatterid.com/peers/peer0.verifier.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/verifier.scatterid.com/users/Admin@verifier.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:8051

$FABRIC_BIN/peer channel join -b channel-artifacts/scatterid-channel.block
set -e

# 6. Package chaincode
if [ ! -f "scatterproof.tar.gz" ]; then
    echo "Packaging chaincode..."
    $FABRIC_BIN/peer lifecycle chaincode package scatterproof.tar.gz --path "$DIR/../chaincode/src" --lang golang --label scatterproof_1.0
fi

# 7. Install chaincode on Issuer
echo "Installing chaincode on peer0.issuer.scatterid.com..."
export CORE_PEER_LOCALMSPID=IssuerMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/issuer.scatterid.com/peers/peer0.issuer.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/issuer.scatterid.com/users/Admin@issuer.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

set +e
$FABRIC_BIN/peer lifecycle chaincode install scatterproof.tar.gz
INSTALL_RES=$?
set -e

# Install chaincode on Verifier
echo "Installing chaincode on peer0.verifier.scatterid.com..."
export CORE_PEER_LOCALMSPID=VerifierMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/verifier.scatterid.com/peers/peer0.verifier.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/verifier.scatterid.com/users/Admin@verifier.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:8051

set +e
$FABRIC_BIN/peer lifecycle chaincode install scatterproof.tar.gz
set -e

# Package ID calculated dynamically based on content
CC_PACKAGE_ID=$($FABRIC_BIN/peer lifecycle chaincode calculatepackageid scatterproof.tar.gz)
echo "Dynamic Package ID: $CC_PACKAGE_ID"

# 8. Approve chaincode for Issuer
echo "Approving chaincode definition for IssuerOrg..."
export CORE_PEER_LOCALMSPID=IssuerMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/issuer.scatterid.com/peers/peer0.issuer.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/issuer.scatterid.com/users/Admin@issuer.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

set +e
$FABRIC_BIN/peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.scatterid.com --channelID scatterid-channel --name scatterproof --version 1.0 --package-id "$CC_PACKAGE_ID" --sequence 1 --tls --cafile "$ORDERER_CA"
set -e

# Approve chaincode for Verifier
echo "Approving chaincode definition for VerifierOrg..."
export CORE_PEER_LOCALMSPID=VerifierMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/verifier.scatterid.com/peers/peer0.verifier.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/verifier.scatterid.com/users/Admin@verifier.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:8051

set +e
$FABRIC_BIN/peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.scatterid.com --channelID scatterid-channel --name scatterproof --version 1.0 --package-id "$CC_PACKAGE_ID" --sequence 1 --tls --cafile "$ORDERER_CA"
set -e

# 9. Commit chaincode
echo "Committing chaincode to channel..."
export CORE_PEER_LOCALMSPID=IssuerMSP
export CORE_PEER_TLS_ROOTCERT_FILE="$DIR/organizations/peerOrganizations/issuer.scatterid.com/peers/peer0.issuer.scatterid.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="$DIR/organizations/peerOrganizations/issuer.scatterid.com/users/Admin@issuer.scatterid.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

set +e
$FABRIC_BIN/peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.scatterid.com --channelID scatterid-channel --name scatterproof --version 1.0 --sequence 1 --tls --cafile "$ORDERER_CA" --peerAddresses localhost:7051 --tlsRootCertFiles "$DIR/organizations/peerOrganizations/issuer.scatterid.com/peers/peer0.issuer.scatterid.com/tls/ca.crt" --peerAddresses localhost:8051 --tlsRootCertFiles "$DIR/organizations/peerOrganizations/verifier.scatterid.com/peers/peer0.verifier.scatterid.com/tls/ca.crt"
set -e

echo "=== Custom Fabric Network Started and Chaincode Deployed successfully ==="

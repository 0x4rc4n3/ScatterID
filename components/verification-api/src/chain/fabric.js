import grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurations
const channelName = process.env.FABRIC_CHANNEL_NAME || 'scatterid-channel';
const chaincodeName = process.env.FABRIC_CHAINCODE_NAME || 'scatterproof';
const mspId = process.env.FABRIC_MSP_ID || 'IssuerMSP';

const peerEndpoint = process.env.FABRIC_PEER_ENDPOINT || (fsSync.existsSync('/app/blockchain') ? 'peer0.issuer.scatterid.com:7051' : 'localhost:7051');
const peerHostAlias = process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.issuer.scatterid.com';

const defaultCryptoPath = path.resolve(__dirname, '../../../blockchain/fabric-network/organizations/peerOrganizations/issuer.scatterid.com');
const containerCryptoPath = '/app/blockchain/fabric-network/organizations/peerOrganizations/issuer.scatterid.com';

const cryptoPath = process.env.FABRIC_CRYPTO_PATH || (
  fsSync.existsSync(containerCryptoPath) ? containerCryptoPath : defaultCryptoPath
);

const keyDirectoryPath = path.resolve(cryptoPath, 'users/User1@issuer.scatterid.com/msp/keystore');
const certDirectoryPath = path.resolve(cryptoPath, 'users/User1@issuer.scatterid.com/msp/signcerts');
const tlsCertPath = path.resolve(cryptoPath, 'peers/peer0.issuer.scatterid.com/tls/ca.crt');

async function getFirstDirFileName(dirPath) {
  const files = await fs.readdir(dirPath);
  // Filter out hidden/system files and select matching cert/key files
  const file = files.find(f => !f.startsWith('.') && (f.endsWith('.pem') || f.endsWith('.crt') || f.endsWith('_sk') || !f.includes('.')));
  if (!file) {
    const fallback = files.find(f => !f.startsWith('.'));
    if (!fallback) throw new Error(`No files in directory: ${dirPath}`);
    return path.join(dirPath, fallback);
  }
  return path.join(dirPath, file);
}

async function newIdentity() {
  const certPath = await getFirstDirFileName(certDirectoryPath);
  const credentials = await fs.readFile(certPath);
  return { mspId, credentials };
}

async function newSigner() {
  const keyPath = await getFirstDirFileName(keyDirectoryPath);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

let gatewayConnection = null;
let clientConnection = null;
let contractInstance = null;

function resetConnection() {
  if (gatewayConnection) {
    try { gatewayConnection.close(); } catch (_) {}
    gatewayConnection = null;
  }
  if (clientConnection) {
    try { clientConnection.close(); } catch (_) {}
    clientConnection = null;
  }
  contractInstance = null;
}

async function getContract() {
  if (contractInstance) {
    return contractInstance;
  }

  try {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    clientConnection = new grpc.Client(peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': peerHostAlias,
      'grpc.keepalive_time_ms': 120000,
      'grpc.http2.min_time_between_pings_ms': 60000,
      'grpc.keepalive_timeout_ms': 20000,
    });

    gatewayConnection = connect({
      client: clientConnection,
      identity: await newIdentity(),
      signer: await newSigner(),
      hash: hash.sha256,
    });

    const network = gatewayConnection.getNetwork(channelName);
    contractInstance = network.getContract(chaincodeName);
    return contractInstance;
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function anchorProof(credentialId, dataHash, issuerId) {
  try {
    const contract = await getContract();
    const timestamp = new Date().toISOString();
    const commit = await contract.submitAsync('AnchorProof', {
      arguments: [credentialId, dataHash, issuerId || mspId, timestamp]
    });
    const txId = commit.getTransactionId();
    const status = await commit.getStatus();
    if (!status.successful) {
      throw new Error(`Transaction ${txId} failed to commit with status ${status.code}`);
    }
    return txId;
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function queryProof(credentialId) {
  try {
    const contract = await getContract();
    const resultBytes = await contract.evaluateTransaction('QueryProof', credentialId);
    return JSON.parse(new TextDecoder().decode(resultBytes));
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function revokeProof(credentialId, issuerId) {
  try {
    const contract = await getContract();
    const resultBytes = await contract.submitTransaction('RevokeProof', credentialId, issuerId || mspId);
    const resultStr = new TextDecoder().decode(resultBytes);
    if (!resultStr || resultStr.trim() === '') return { success: true };
    try {
      return JSON.parse(resultStr);
    } catch {
      return { success: true, raw: resultStr };
    }
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function proofExists(credentialId) {
  try {
    const contract = await getContract();
    const resultBytes = await contract.evaluateTransaction('ProofExists', credentialId);
    return new TextDecoder().decode(resultBytes) === 'true';
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function getProofHistory(credentialId) {
  try {
    const contract = await getContract();
    const resultBytes = await contract.evaluateTransaction('GetProofHistory', credentialId);
    return JSON.parse(new TextDecoder().decode(resultBytes));
  } catch (err) {
    resetConnection();
    throw err;
  }
}

// Clean up connections on process exit
process.on('exit', () => {
  resetConnection();
});

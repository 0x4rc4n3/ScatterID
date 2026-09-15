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

// Single-peer configuration (write path uses this)
const peerEndpoint = process.env.FABRIC_PEER_ENDPOINT || (fsSync.existsSync('/app/blockchain') ? 'peer0.issuer.scatterid.com:7051' : 'localhost:7051');
const peerHostAlias = process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.issuer.scatterid.com';

// Multi-peer read configuration (Priority 3A fix: query multiple peers instead of one).
// Set FABRIC_PEER_ENDPOINTS as a comma-separated list for redundant reads.
// Falls back to the single peerEndpoint if not configured.
const PEER_ENDPOINTS_RAW = process.env.FABRIC_PEER_ENDPOINTS || peerEndpoint;
const PEER_ENDPOINTS = PEER_ENDPOINTS_RAW.split(',').map(s => s.trim()).filter(Boolean);

// Peer aliases: space-separated, one per endpoint in order. Falls back to peerHostAlias for all.
const PEER_ALIASES_RAW = process.env.FABRIC_PEER_HOST_ALIASES || peerHostAlias;
const PEER_ALIASES = PEER_ALIASES_RAW.split(',').map(s => s.trim()).filter(Boolean);

const PEER_MAX_RETRIES = parseInt(process.env.FABRIC_PEER_MAX_RETRIES || '3', 10);
const PEER_RETRY_DELAY_MS = parseInt(process.env.FABRIC_PEER_RETRY_DELAY_MS || '500', 10);

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
let injectedContract = null;

export function setContractInstance(instance) {
  injectedContract = instance;
  contractInstance = instance;
}

export function resetConnection() {
  if (gatewayConnection) {
    try { gatewayConnection.close(); } catch (_) {}
    gatewayConnection = null;
  }
  if (clientConnection) {
    try { clientConnection.close(); } catch (_) {}
    clientConnection = null;
  }
  contractInstance = injectedContract || null;
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

/**
 * Creates a single-use gRPC client + gateway for a specific peer endpoint.
 * Used by the multi-peer read path to try each peer independently.
 */
async function getPeerContract(endpoint, hostAlias) {
  const tlsRootCert = await fs.readFile(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  const peerClient = new grpc.Client(endpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': hostAlias,
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
  });

  const gw = connect({
    client: peerClient,
    identity: await newIdentity(),
    signer: await newSigner(),
    hash: hash.sha256,
  });

  const network = gw.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);
  return { contract, gw, peerClient };
}

/**
 * Sleep helper for retry back-off.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * evaluateWithMultiPeerRetry — queries multiple Fabric peers with per-peer retry.
 *
 * Priority 3A fix: instead of querying one peer with no retry (where a single network
 * blip produces the same outcome as a real revocation), this queries all configured
 * peers in order, retrying each PEER_MAX_RETRIES times before moving to the next.
 * Returns the first successful result. Only throws if ALL peers fail after all retries.
 *
 * SECURITY NOTE: This fixes an *availability* SPOF only. The fail-closed rule
 * in verify.js is unchanged — if all peers are truly unreachable the verifier
 * still returns ledger_unreachable (invalid). Multi-peer + retry only reduces
 * how often a transient single-peer blip triggers that path for no good reason.
 */
async function evaluateWithMultiPeerRetry(fcn, ...args) {
  // If injected contract is set (tests), use it directly
  if (injectedContract) {
    const resultBytes = await injectedContract.evaluateTransaction(fcn, ...args);
    return new TextDecoder().decode(resultBytes);
  }

  const errors = [];

  for (let peerIdx = 0; peerIdx < PEER_ENDPOINTS.length; peerIdx++) {
    const endpoint = PEER_ENDPOINTS[peerIdx];
    const alias = PEER_ALIASES[peerIdx] || PEER_ALIASES[0] || peerHostAlias;

    for (let attempt = 1; attempt <= PEER_MAX_RETRIES; attempt++) {
      let peerConn = null;
      try {
        peerConn = await getPeerContract(endpoint, alias);
        const resultBytes = await peerConn.contract.evaluateTransaction(fcn, ...args);
        return new TextDecoder().decode(resultBytes);
      } catch (err) {
        const msg = `peer=${endpoint} attempt=${attempt}/${PEER_MAX_RETRIES}: ${err.message}`;
        errors.push(msg);
        if (attempt < PEER_MAX_RETRIES) {
          await sleep(PEER_RETRY_DELAY_MS);
        }
      } finally {
        if (peerConn) {
          try { peerConn.gw.close(); } catch (_) {}
          try { peerConn.peerClient.close(); } catch (_) {}
        }
      }
    }
  }

  throw new Error(`All ${PEER_ENDPOINTS.length} Fabric peer(s) unreachable after retries: ${errors.join('; ')}`);
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
    // Read path: use multi-peer retry to avoid single-peer blips triggering fail-closed
    const resultStr = await evaluateWithMultiPeerRetry('QueryProof', credentialId);
    return JSON.parse(resultStr);
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function revokeProof(credentialId, issuerId) {
  try {
    // Write path: uses the single primary peer — unchanged from before
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
    // Read path: use multi-peer retry
    const resultStr = await evaluateWithMultiPeerRetry('ProofExists', credentialId);
    return resultStr === 'true';
  } catch (err) {
    resetConnection();
    throw err;
  }
}

export async function getProofHistory(credentialId) {
  try {
    // Read path: use multi-peer retry
    const resultStr = await evaluateWithMultiPeerRetry('GetProofHistory', credentialId);
    return JSON.parse(resultStr);
  } catch (err) {
    resetConnection();
    throw err;
  }
}

// Clean up connections on process exit
process.on('exit', () => {
  resetConnection();
});

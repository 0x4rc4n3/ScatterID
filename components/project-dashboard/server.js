import express from 'express';
import { exec } from 'child_process';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { createHash, createHmac } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const VERIFICATION_API_URL = process.env.VERIFICATION_API_URL || 'http://verification-api:3000';
const CRYPTO_SERVICE_HOST = process.env.CRYPTO_SERVICE_HOST || 'crypto-service';
const VERIFICATION_API_HOST = process.env.VERIFICATION_API_HOST || 'verification-api';
let GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'disabled';
function getHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

const validContainers = [
  'orderer.scatterid.com',
  'peer0.issuer.scatterid.com',
  'peer0.verifier.scatterid.com',
  'scatterid-verification',
  'scatterid-crypto',
  'scatterid-vault',
  'scatterid-dashboard',
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/demo.html'));
});

// Proxy route for real backend verification
app.post('/api/verify', async (req, res) => {
  const { credentialId } = req.body;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!credentialId || !uuidRegex.test(credentialId)) {
    return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4' });
  }

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ credentialId }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy verify route:', err.stack || err.message);
    res.status(500).json({ error: 'Verification API is unreachable' });
  }
});

// Helper to check if a port/host is reachable
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// Helper to run shell commands
function runCmd(command) {
  return new Promise((resolve) => {
    exec(command, { cwd: path.resolve(__dirname, '../..') }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : ''
      });
    });
  });
}

// API: System Status
app.get('/api/status', async (req, res) => {
  const cryptoServiceUp = await checkPort(5001, CRYPTO_SERVICE_HOST) || await checkPort(5001, '127.0.0.1');
  const verificationApiUp = await checkPort(3000, VERIFICATION_API_HOST) || await checkPort(3000, '127.0.0.1');

  let ordererUp = await checkPort(7050, 'orderer.scatterid.com') || await checkPort(7050, 'host.docker.internal') || await checkPort(7050, '127.0.0.1');
  let issuerPeerUp = await checkPort(7051, 'peer0.issuer.scatterid.com') || await checkPort(7051, 'host.docker.internal') || await checkPort(7051, '127.0.0.1');
  let verifierPeerUp = await checkPort(8051, 'peer0.verifier.scatterid.com') || await checkPort(8051, 'host.docker.internal') || await checkPort(8051, '127.0.0.1');

  const dockerInfo = await runCmd('docker ps --format "{{.Names}}: {{.Status}}"');
  if (dockerInfo.success && dockerInfo.stdout) {
    const output = dockerInfo.stdout;
    if (output.includes('orderer.scatterid.com')) ordererUp = true;
    if (output.includes('peer0.issuer.scatterid.com')) issuerPeerUp = true;
    if (output.includes('peer0.verifier.scatterid.com')) verifierPeerUp = true;
  }

  res.json({
    services: {
      cryptoService: cryptoServiceUp ? 'RUNNING' : 'STOPPED',
      verificationApi: verificationApiUp ? 'RUNNING' : 'STOPPED'
    },
    blockchain: {
      orderer: ordererUp ? 'RUNNING' : 'OFFLINE',
      issuerPeer: issuerPeerUp ? 'RUNNING' : 'OFFLINE',
      verifierPeer: verifierPeerUp ? 'RUNNING' : 'OFFLINE'
    }
  });
});

// API: Credentials List (Proxied from Verification API)
app.get('/api/credentials', async (req, res) => {
  try {
    const response = await fetch(`${VERIFICATION_API_URL}/credentials`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy credentials list query:', err.stack || err.message);
    res.json({ success: false, error: 'Verification API unreachable', credentials: [] });
  }
});

// Proxy route for credential issuance / anchoring
app.post('/api/issue', async (req, res) => {
  const { claim } = req.body;
  const payload = claim || {
    student: 'Anchor Sync Test Subject',
    degree: 'Master of Science in PQC Cryptography',
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/issue`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ claim: payload }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy issue route:', err.stack || err.message);
    res.status(500).json({ error: 'Verification API unreachable' });
  }
});

// API: Get Single Credential Detail by ID
app.get('/api/credentials/:id', async (req, res) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid parameter: id must be a valid UUID v4' });
  }

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/status/${id}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json({ success: true, credential: data });
  } catch (err) {
    console.error('Failed to fetch credential detail:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// API: Run E2E Diagnostics (Smoke Test)
app.post('/api/diagnostics/run', async (req, res) => {
  const logs = [];
  const addLog = (step, detail, status = 'info') => {
    logs.push({ timestamp: new Date().toISOString(), step, detail, status });
  };

  try {
    addLog('Start', 'Initiating E2E Diagnostics Smoke Test', 'info');

    // 1. Verify Verification API is up
    const apiUp = await checkPort(3000, VERIFICATION_API_HOST) || await checkPort(3000, '127.0.0.1');
    if (!apiUp) {
      addLog('Verification API Check', 'Verification API is offline on port 3000', 'error');
      return res.json({ success: false, logs });
    }
    addLog('Verification API Check', 'Verification API is active on port 3000', 'success');

    // 2. Verify Crypto Service is up
    const cryptoUp = await checkPort(5001, CRYPTO_SERVICE_HOST) || await checkPort(5001, '127.0.0.1');
    if (!cryptoUp) {
      addLog('Crypto Service Check', 'Crypto Service is offline on port 5001', 'error');
      return res.json({ success: false, logs });
    }
    addLog('Crypto Service Check', 'Crypto Service is active on port 5001', 'success');

    // 3. Trigger /issue
    addLog('Credential Issuance', `Sending POST request to ${VERIFICATION_API_URL}/issue`, 'info');
    const claim = {
      subject: 'Diagnostic Test User',
      role: 'Master of Science in Cybersecurity',
      timestamp: new Date().toISOString()
    };

    const issueResponse = await fetch(`${VERIFICATION_API_URL}/issue`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ claim })
    });

    if (!issueResponse.ok) {
      const errText = await issueResponse.text();
      addLog('Credential Issuance', `API rejected issuance request: ${errText}`, 'error');
      return res.json({ success: false, logs });
    }

    const issueResult = await issueResponse.json();
    addLog('Credential Issuance', `Successfully issued. Credential ID: ${issueResult.credentialId}. TxID: ${issueResult.anchorTxId || 'Pending'}`, 'success');

    const credId = issueResult.credentialId;

    // 4. Trigger /verify
    addLog('Credential Verification', `Sending POST request to ${VERIFICATION_API_URL}/verify for ${credId}`, 'info');
    const verifyResponse = await fetch(`${VERIFICATION_API_URL}/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ credentialId: credId })
    });

    if (!verifyResponse.ok) {
      const errText = await verifyResponse.text();
      addLog('Credential Verification', `API rejected verification request: ${errText}`, 'error');
      return res.json({ success: false, logs });
    }

    const verifyResult = await verifyResponse.json();
    if (verifyResult.valid) {
      addLog('Credential Verification', `Verification SUCCEEDED. Anchor Status: ${verifyResult.anchorStatus}`, 'success');
    } else {
      addLog('Credential Verification', `Verification FAILED. Reason: ${verifyResult.reason || 'Unknown'}`, 'error');
    }

    res.json({ success: true, logs });
  } catch (err) {
    addLog('Exception', `Unexpected error during smoke test: ${err.message}`, 'error');
    res.json({ success: false, logs });
  }
});

// API: Docker Logs
app.get('/api/logs/:container', async (req, res) => {
  const container = req.params.container;

  if (!validContainers.includes(container)) {
    return res.status(400).json({ success: false, error: 'Invalid container name' });
  }

  const logs = await runCmd(`docker logs --tail 100 ${container}`);
  const logText = (logs.stdout || logs.stderr || ('No log output available for ' + container)).trim();
  res.json({
    success: true,
    logs: logText,
    content: logText
  });
});

// API: Settings & Key rotation
app.get('/api/settings', (req, res) => {
  try {
    const dbPath = path.join(process.env.DB_DIR || '/app/data', 'gateway_system.db');
    if (!fsSync.existsSync(dbPath)) {
      return res.status(204).json({ success: false, error: 'System database not found yet.' });
    }
    // Settings are only available when running in Docker with the system DB
    return res.status(204).json({ success: false, error: 'Settings not available in this environment.' });
  } catch (err) {
    console.error('Failed to get settings:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/rotate', async (req, res) => {
  try {
    const response = await fetch(`${VERIFICATION_API_URL}/rotate-key`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, error: errText });
    }
    
    const data = await response.json();
    if (data.success) {
      console.log(`[Dashboard] API Key rotated dynamically.`);
    }
    
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy key rotation:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Verification API unreachable' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ScatterID Project Dashboard running at http://0.0.0.0:${PORT}`);
});

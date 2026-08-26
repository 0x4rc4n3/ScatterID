import express from 'express';
import { exec } from 'child_process';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { createHash, createHmac } from 'crypto';
import Database from 'better-sqlite3';

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

// Path to SQLite DB
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../verification-api/credentials.db');

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

  // Check Docker containers (or direct TCP ports for container environment)
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

  const { nodeName, action } = req.body;
  if (!nodeName || !['stop', 'start'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Invalid parameters. Requires nodeName and action (stop|start).' });
  }

  const containerMap = {
  };

  const targetContainer = containerMap[nodeName];
  if (!targetContainer || !validContainers.includes(targetContainer)) {
    return res.status(400).json({ success: false, error: 'Invalid parameter: nodeName is not a permitted container node' });
  }

  const cmd = action === 'stop' ? `docker stop -t 1 ${targetContainer}` : `docker start ${targetContainer}`;
  const result = await runCmd(cmd);
  
  if (result.success) {
    // If starting a container, wait until its HTTP health endpoint responds OK (up to 3s)
    if (action === 'start') {
      let healEvents = [];
      if (nodeIdMatch) {
        const nodeId = nodeIdMatch[1];
        const headers = {};
        }
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            const hRes = await fetch(healthUrl, { headers, signal: AbortSignal.timeout(600) });
            if (hRes.ok) break;
          } catch (e) {}
          await new Promise(r => setTimeout(r, 250));
        }

        try {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ nodeId })
          });
          if (healRes.ok) {
            const hData = await healRes.json();
            healEvents = hData.events || [];
          }
        } catch (e) {}
      }
      return res.json({ success: true, nodeName, targetContainer, action, healed: true, healEvents, message: `Container ${targetContainer} started and auto-synced successfully.` });
    }
    res.json({ success: true, nodeName, targetContainer, action, message: `Container ${targetContainer} stopped successfully.` });
  } else {
    res.status(500).json({ success: false, nodeName, targetContainer, action, error: result.stderr || `Failed to ${action} ${targetContainer}.` });
  }
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

// Proxy route for custom claim issuance / anchoring
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
app.get('/api/credentials/:id', (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid parameter: id must be a valid UUID v4' });
    }
    const candidateDirs = [
      process.env.DB_DIR || '/app/data',
      '/app/data',
      path.resolve(__dirname, '../verification-api/data'),
      path.resolve(__dirname, 'verification-api'),
      path.resolve(__dirname, '../verification-api'),
      '/app/verification-api',
      '/app',
      process.cwd()
    ];

    let foundBaseDir = candidateDirs.find(dir => fsSync.existsSync(path.join(dir, 'node_1.db'))) || candidateDirs.find(dir => fsSync.existsSync(path.join(dir, 'credentials.db')));
    if (!foundBaseDir) {
      return res.status(404).json({ success: false, error: 'Database directory not found' });
    }

    let cred = null;
    for (let i = 1; i <= 5; i++) {
      const nodePath = path.join(foundBaseDir, `node_${i}.db`);
      if (fsSync.existsSync(nodePath)) {
        try {
          const nDb = new Database(nodePath, { readonly: true });
          cred = nDb.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
          nDb.close();
          if (cred) break;
        } catch (e) {}
      }
    }

    if (!cred) {
      return res.status(404).json({ success: false, error: 'Credential not found' });
    }

    for (let i = 1; i <= 5; i++) {
      const nodePath = path.join(foundBaseDir, `node_${i}.db`);
      if (fsSync.existsSync(nodePath)) {
        try {
          const nDb = new Database(nodePath, { readonly: true });
          nDb.close();
        } catch (e) {}
      }
    }

    res.json({
      success: true,
      credential: {
        ...cred,
      }
    });
  } catch (err) {
    console.error('Failed to query local database fallback for credential:', err.stack || err.message);
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

// API: Get Progress and Docs
app.get('/api/progress', async (req, res) => {
  try {
    const candidatePaths = [
      '/app/docs/system/Progress.md',
      path.resolve(__dirname, '../../docs/system/Progress.md'),
      '/app/Progress.md',
      path.resolve(__dirname, 'Progress.md'),
      path.resolve(__dirname, '../../Progress.md'),
      path.resolve(process.cwd(), 'Progress.md')
    ];

    const validPath = candidatePaths.find(p => fsSync.existsSync(p));
    if (!validPath) {
      return res.json({ success: false, error: 'Progress.md not found on disk' });
    }

    const content = await fs.readFile(validPath, 'utf8');
    res.json({ success: true, content });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

  try {
    const candidateDirs = [
      process.env.DB_DIR || '/app/data',
      '/app/data',
      path.resolve(__dirname, '../verification-api/data'),
      path.resolve(__dirname, '../verification-api'),
      '/app/verification-api',
      '/app',
      process.cwd()
    ];

    let foundBaseDir = candidateDirs.find(dir => fsSync.existsSync(path.join(dir, 'node_1.db')));
    if (!foundBaseDir) {
      foundBaseDir = path.resolve(__dirname, '../verification-api');
    }

    const dockerPs = await runCmd('docker ps --format "{{.Names}}"');
    const runningList = dockerPs.success ? dockerPs.stdout.split('\n') : [];

    const nodeReports = [];
    for (let i = 1; i <= 5; i++) {
      const isContainerRunning = runningList.some(name => name.includes(containerName));
      let nodeReport = null;

      if (isContainerRunning) {
        try {
          const headers = {};
          }
          const r = await fetch(nodeUrl, { headers, signal: AbortSignal.timeout(1200) });
          if (r.ok) {
            const data = await r.json();
            nodeReport = {
              nodeId: i,
              path: nodeUrl,
              exists: true,
              sizeBytes: data.sizeBytes || 0,
              totalShares: data.totalShares || 0,
              status: data.status || 'HEALTHY',
              integrityCheck: data.integrityCheck || 'VALID'
            };
          }
        } catch (e) {}
      }

      if (!nodeReport) {
        const nodePath = path.join(foundBaseDir, `node_${i}.db`);
        const exists = fsSync.existsSync(nodePath);
        let sizeBytes = 0;
        let totalShares = 0;
        let integrityCheck = isContainerRunning ? 'PROBE_FAILED' : 'CONTAINER_STOPPED';

        if (exists) {
          try {
            const stats = fsSync.statSync(nodePath);
            sizeBytes = stats.size;

            const nDb = new Database(nodePath, { readonly: true });
            totalShares = countRow ? countRow.count : 0;
            nDb.close();
          } catch (e) {}
        }

        nodeReport = {
          nodeId: i,
          dbName: `node_${i}.db`,
          path: nodePath,
          exists,
          sizeBytes,
          totalShares,
          status: isContainerRunning ? 'HEALTHY' : 'OFFLINE',
          integrityCheck
        };
      }

      nodeReports.push(nodeReport);
    }

    res.json({ success: true, baseDir: foundBaseDir, nodes: nodeReports });
  } catch (err) {
    res.json({ success: false, error: 'Internal Server Error', nodes: [] });
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
    const systemDb = new Database(dbPath);
    
    const hashed = createHash('sha256').update(GATEWAY_API_KEY).digest('hex');
    const profile = systemDb.prepare('SELECT * FROM api_keys WHERE api_key_hash = ?').get(hashed);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Tenant profile not found for active API key.' });
    }
    
    res.json({
      success: true,
      tenantId: profile.tenant_id,
      tier: profile.tier,
      quotaLimit: profile.quota_limit,
      quotaUsed: profile.quota_used,
      apiKeyHashed: profile.api_key_hash
    });
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

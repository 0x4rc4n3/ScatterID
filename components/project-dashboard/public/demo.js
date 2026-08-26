// ScatterID Enterprise Presentation Portal JS (Real Backend Integration)

document.addEventListener('DOMContentLoaded', () => {
  initStandaloneDemo();
  initTabDemo();
});

function initStandaloneDemo() {
  const btnClient = document.getElementById('btn-view-client');
  const btnTelemetry = document.getElementById('btn-view-telemetry');
  const viewClient = document.getElementById('view-client');
  const viewTelemetry = document.getElementById('view-telemetry');

  if (btnClient && btnTelemetry && viewClient && viewTelemetry) {
    btnClient.addEventListener('click', () => {
      btnClient.classList.add('active');
      btnTelemetry.classList.remove('active');
      viewClient.classList.add('active');
      viewTelemetry.classList.remove('active');
    });

    btnTelemetry.addEventListener('click', () => {
      btnTelemetry.classList.add('active');
      btnClient.classList.remove('active');
      viewTelemetry.classList.add('active');
      viewClient.classList.remove('active');
      loadShardTelemetry('telemetry-shard-matrix');
    });

    loadSampleCredentials('sample-credentials-list', 'credential-input');
    loadShardTelemetry('telemetry-shard-matrix');

    const btnVerify = document.getElementById('btn-run-verify');
    const inputCred = document.getElementById('credential-input');
    if (btnVerify && inputCred) {
      btnVerify.addEventListener('click', () => {
        const val = inputCred.value.trim();
        if (val) verifyCredentialStandalone(val);
      });
    }

    const btnRefresh = document.getElementById('btn-refresh-shards');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => loadShardTelemetry('telemetry-shard-matrix'));
    }

    const btnIssueAnchor = document.getElementById('btn-issue-new-anchor');
    if (btnIssueAnchor) {
      btnIssueAnchor.addEventListener('click', issueAndAnchorNewCredential);
    }
  }
}

async function issueAndAnchorNewCredential() {
  const subjectInput = document.getElementById('anchor-subject-input');
  const roleInput = document.getElementById('anchor-role-input');
  const btnIssue = document.getElementById('btn-issue-new-anchor');
  const outputPanel = document.getElementById('anchor-output-panel');
  const consoleOut = document.getElementById('anchor-console-output');

  if (!btnIssue || !consoleOut || !outputPanel) return;

  const subject = subjectInput ? subjectInput.value.trim() : 'did:scatterid:user-99';
  const role = roleInput ? roleInput.value.trim() : 'Security Engineer';

  btnIssue.disabled = true;
  btnIssue.textContent = 'Executing Cryptographic Pipeline...';
  outputPanel.classList.remove('hidden');
  consoleOut.innerHTML = `<div class="log-line info">[1/4] Signing claim payload via PQC ML-DSA-65 (Vault KMS)...</div>`;

  try {
    const claim = { subject, role, timestamp: new Date().toISOString() };
    const res = await fetch('/api/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
    });

    const data = await res.json();
    if (!res.ok) {
      consoleOut.innerHTML += `<div class="log-line error">[ERROR] API rejected issuance: ${data.error || 'Unknown'}</div>`;
      return;
    }

    consoleOut.innerHTML += `<div class="log-line success">[2/4] Zero-Knowledge Verification Secret Sharding (k=3 / n=5) complete. Data Hash: ${data.dataHash || '--'}</div>`;
    consoleOut.innerHTML += `<div class="log-line success">[3/4] Hyperledger Fabric Anchor Committed! TxID: ${data.anchorTxId || 'Pending'}</div>`;
    consoleOut.innerHTML += `<div class="log-line info">[4/4] Multi-Node Shard Dispatch Report:</div>`;

    if (data.dispatchReport && data.dispatchReport.length > 0) {
      data.dispatchReport.forEach(r => {
        const isOk = r.httpStatus === 'WRITTEN';
        const color = isOk ? '#10b981' : '#ef4444';
        consoleOut.innerHTML += `<div class="log-line" style="color: ${color}; margin-left: 12px;">-> Shard ${r.nodeId} (${r.containerUrl}): HTTP=${r.httpStatus} | LocalDB=${r.localDbStatus} | Hash=${r.shareHash}</div>`;
      });
    }

    consoleOut.innerHTML += `<div class="log-line highlight" style="margin-top: 8px; color: #38bdf8;">=> Credential Issued Successfully! Credential ID: ${data.credentialId}</div>`;

    // Auto-set as active input in verification panel
    const inputCred = document.getElementById('credential-input');
    if (inputCred) inputCred.value = data.credentialId;

    // Refresh telemetry matrix and samples list
    loadShardTelemetry('telemetry-shard-matrix');
    loadSampleCredentials('sample-credentials-list', 'credential-input');

  } catch (err) {
    consoleOut.innerHTML += `<div class="log-line error">[EXCEPTION] Issuance failed: ${err.message}</div>`;
  } finally {
    btnIssue.disabled = false;
    btnIssue.textContent = '🔒 Issue & Anchor Credential (PQC Sign -> 5-Node Shard -> Fabric Commit)';
  }
}

function initTabDemo() {
  const btnTabClient = document.getElementById('btn-view-client-tab');
  const btnTabTelemetry = document.getElementById('btn-view-telemetry-tab');
  const viewTabClient = document.getElementById('demo-tab-client');
  const viewTabTelemetry = document.getElementById('demo-tab-telemetry');

  if (btnTabClient && btnTabTelemetry && viewTabClient && viewTabTelemetry) {
    btnTabClient.addEventListener('click', () => {
      btnTabClient.classList.add('active');
      btnTabTelemetry.classList.remove('active');
      viewTabClient.style.display = 'block';
      viewTabTelemetry.style.display = 'none';
    });

    btnTabTelemetry.addEventListener('click', () => {
      btnTabTelemetry.classList.add('active');
      btnTabClient.classList.remove('active');
      viewTabClient.style.display = 'none';
      viewTabTelemetry.style.display = 'block';
      loadShardTelemetry('tab-telemetry-shard-matrix');
    });

    loadSampleCredentials('tab-sample-credentials-list', 'tab-credential-input');
    loadShardTelemetry('tab-telemetry-shard-matrix');

    const btnVerify = document.getElementById('tab-btn-run-verify');
    const inputCred = document.getElementById('tab-credential-input');
    if (btnVerify && inputCred) {
      btnVerify.addEventListener('click', () => {
        const val = inputCred.value.trim();
        if (val) verifyCredentialTab(val);
      });
    }

    const btnRefresh = document.getElementById('tab-btn-refresh-shards');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => loadShardTelemetry('tab-telemetry-shard-matrix'));
    }
  }
}

// Load Sample Credentials without auto-verifying (waits for user button click)
async function loadSampleCredentials(listContainerId, inputId) {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  try {
    const res = await fetch('/api/credentials');
    const data = await res.json();

    const validCreds = (data.credentials || []).filter(c => c.shards && c.shards.length >= 3 && c.status !== 'failed');

    if (validCreds.length > 0) {
      container.innerHTML = '';
      validCreds.slice(0, 3).forEach(row => {
        const pill = document.createElement('span');
        pill.className = 'sample-pill';
        pill.textContent = row.id;
        pill.title = `Click to set input ID to ${row.id}`;
        pill.addEventListener('click', () => {
          const input = document.getElementById(inputId);
          if (input) input.value = row.id;
        });
        container.appendChild(pill);
      });

      const input = document.getElementById(inputId);
      if (input && !input.value.trim()) {
        input.value = validCreds[0].id;
      }
    } else {
      // Auto-issue a real sample credential if no valid ones exist in DB
      container.innerHTML = '<span class="pill-label loading">Issuing real post-quantum sample credential...</span>';
      const issueRes = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: { sample: 'Enterprise Sandbox Identity', timestamp: new Date().toISOString() } })
      });
      const newCred = await issueRes.json();
      if (newCred && newCred.credentialId) {
        // Re-query credentials
        const req2 = await fetch('/api/credentials');
        const d2 = await req2.json();
        container.innerHTML = '';
        (d2.credentials || []).slice(0, 3).forEach(row => {
          const pill = document.createElement('span');
          pill.className = 'sample-pill';
          pill.textContent = row.id;
          pill.title = `Click to set input ID to ${row.id}`;
          pill.addEventListener('click', () => {
            const input = document.getElementById(inputId);
            if (input) input.value = row.id;
          });
          container.appendChild(pill);
        });
        const input = document.getElementById(inputId);
        if (input) input.value = newCred.credentialId;
      } else {
        container.innerHTML = '<span class="pill-label">No valid credentials found. Click "Issue & Anchor Credential" to create one.</span>';
      }
    }
  } catch (err) {
    container.innerHTML = '<span class="pill-label">Demo offline Mode</span>';
  }
}

async function verifyCredentialStandalone(credentialId) {
  await genericVerify(
    credentialId,
    'verification-result',
    'result-status-badge',
    'result-issued-at',
    'result-algo',
    'result-shards',
    'result-anchor-status',
    'result-tx-id',
    'btn-run-verify'
  );
}

async function verifyCredentialTab(credentialId) {
  await genericVerify(
    credentialId,
    'tab-verification-result',
    'tab-result-status-badge',
    'tab-result-issued-at',
    'tab-result-algo',
    'tab-result-shards',
    'tab-result-anchor-status',
    'tab-result-tx-id',
    'tab-btn-run-verify'
  );
}

// Real Backend Verification Call
async function genericVerify(credentialId, resultPanelId, badgeId, issuedAtId, algoId, shardsId, anchorStatusId, txId, btnId) {
  const resultPanel = document.getElementById(resultPanelId);
  const statusBadge = document.getElementById(badgeId);
  const issuedAt = document.getElementById(issuedAtId);
  const algoEl = document.getElementById(algoId);
  const shardsEl = document.getElementById(shardsId);
  const anchorStatusEl = document.getElementById(anchorStatusId);
  const txIdEl = document.getElementById(txId);
  const btnVerify = document.getElementById(btnId);

  if (!resultPanel) return;

  if (btnVerify) {
    btnVerify.disabled = true;
    btnVerify.textContent = 'Verifying Backend...';
  }

  try {
    // REAL POST request to backend verification gateway (/api/verify -> verification-api:3000/verify)
    const resVerify = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId }),
    });

    const verifyData = await resVerify.json();
    resultPanel.classList.remove('hidden');

    if (resVerify.ok && verifyData.valid) {
      statusBadge.className = 'badge-status-box valid';
      statusBadge.innerHTML = '<span class="status-icon">✓</span> <span class="status-text">CRYPTOGRAPHICALLY VALIDATED</span>';

      if (issuedAt) issuedAt.textContent = `Issued: ${new Date(verifyData.issuedAt || Date.now()).toLocaleString()}`;
      if (algoEl) algoEl.textContent = 'ML-DSA-65 (NIST FIPS 204)';
      if (shardsEl) shardsEl.textContent = 'Zero-Knowledge Verification Secret Threshold Met (>= 3 Live Shards Validated)';
      if (anchorStatusEl) anchorStatusEl.textContent = `Fabric Anchor (${(verifyData.anchorStatus || 'active').toUpperCase()})`;
      if (txIdEl) txIdEl.textContent = credentialId;
    } else {
      // Verification Failed (e.g. Insufficient Shares due to offline/compromised nodes)
      statusBadge.className = 'badge-status-box invalid';
      const failReason = verifyData.reason || verifyData.error || 'Verification failed on backend';
      statusBadge.innerHTML = `<span class="status-icon">✕</span> <span class="status-text">VERIFICATION FAILED: ${failReason}</span>`;

      if (issuedAt) issuedAt.textContent = `Timestamp: ${new Date().toLocaleString()}`;
      if (algoEl) algoEl.textContent = 'ML-DSA-65 Signature Check Failed';
      if (shardsEl) shardsEl.textContent = failReason;
      if (anchorStatusEl) anchorStatusEl.textContent = `Anchor Status: ${verifyData.anchorStatus || 'FAILED'}`;
      if (txIdEl) txIdEl.textContent = credentialId;
    }
  } catch (err) {
    resultPanel.classList.remove('hidden');
    statusBadge.className = 'badge-status-box invalid';
    statusBadge.innerHTML = `<span class="status-icon">✕</span> <span class="status-text">VERIFICATION ERROR: ${err.message}</span>`;
  } finally {
    if (btnVerify) {
      btnVerify.disabled = false;
      btnVerify.textContent = 'Verify Credential';
    }
  }
}

// Load 5-Node Shard Telemetry
async function loadShardTelemetry(matrixContainerId) {
  const container = document.getElementById(matrixContainerId);
  if (!container) return;

  try {
    const res = await fetch('/api/shards/integrity');
    const data = await res.json();

    if (!data.success || !data.nodes) {
      container.innerHTML = '<div class="text-muted">Failed to query telemetry nodes.</div>';
      return;
    }

    container.innerHTML = '';
    data.nodes.forEach(node => {
      const card = document.createElement('div');
      const isHealthy = node.status === 'HEALTHY';
      card.className = `telemetry-shard-card ${node.status.toLowerCase()}`;
      
      const kbSize = (node.sizeBytes / 1024).toFixed(1);
      const badgeClass = isHealthy ? 'green' : 'red';
      const toggleAction = isHealthy ? 'stop' : 'start';
      const toggleText = isHealthy ? 'Simulate Fault (Stop)' : 'Recover Node (Auto-Heal)';
      const btnClass = isHealthy ? 'btn-danger-sm' : 'btn-success-sm';

      card.innerHTML = `
        <div class="shard-card-header">
          <span class="shard-name">Node ${node.nodeId}</span>
          <span class="status-badge-sm ${badgeClass}">${node.status}</span>
        </div>
        <div class="shard-metrics">
          <div>Shares: <span>${node.totalShares}</span></div>
          <div>Size: <span>${kbSize} KB</span></div>
          <div>SHA3: <span>${node.integrityCheck}</span></div>
        </div>
        <button class="btn-node-action ${btnClass}" data-node="shard-node-${node.nodeId}" data-action="${toggleAction}">
          ${toggleText}
        </button>
      `;

      const btn = card.querySelector('.btn-node-action');
      if (btn) {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          btn.disabled = true;
          btn.innerHTML = toggleAction === 'stop' 
            ? '<span class="spin-icon">⏳</span> Stopping Container...' 
            : '<span class="spin-icon">⏳</span> Starting Container & Auto-Healing...';
          
          try {
            const response = await fetch('/api/shards/toggle-container', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeName: `shard-node-${node.nodeId}`, action: toggleAction }),
              signal: AbortSignal.timeout(8000)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
              console.warn(`Node action status: ${data.error || 'Pending container transition'}`);
            }
          } catch (err) {
            console.warn(`Node transition warning: ${err.message}`);
          }

          setTimeout(async () => {
            await loadShardTelemetry(matrixContainerId);
          }, 600);
        });
      }

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div class="text-muted p-3">Telemetry updating... (${err.message})</div>`;
  }
}

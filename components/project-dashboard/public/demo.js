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
    });

    loadSampleCredentials('sample-credentials-list', 'credential-input');

    const btnVerify = document.getElementById('btn-run-verify');
    const inputCred = document.getElementById('credential-input');
    if (btnVerify && inputCred) {
      btnVerify.addEventListener('click', () => {
        const val = inputCred.value.trim();
        if (val) verifyCredentialStandalone(val);
      });
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
  consoleOut.innerHTML = `<div class="log-line info">[1/3] Signing claim hash via PQC ML-DSA-65 (Vault KMS)...</div>`;

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

    consoleOut.innerHTML += `<div class="log-line success">[2/3] ML-DSA-65 signature generated. PublicKeyId: ${data.publicKeyId || 'N/A'}</div>`;
    consoleOut.innerHTML += `<div class="log-line success">[3/3] Hyperledger Fabric Anchor Committed! TxID: ${data.anchorTxId || 'Pending'}</div>`;
    consoleOut.innerHTML += `<div class="log-line highlight" style="margin-top: 8px; color: #38bdf8;">=> Credential Issued Successfully! Credential ID: ${data.credentialId}</div>`;

    // Auto-set as active input in verification panel
    const inputCred = document.getElementById('credential-input');
    if (inputCred) inputCred.value = data.credentialId;

    // Refresh samples list
    loadSampleCredentials('sample-credentials-list', 'credential-input');

  } catch (err) {
    consoleOut.innerHTML += `<div class="log-line error">[EXCEPTION] Issuance failed: ${err.message}</div>`;
  } finally {
    btnIssue.disabled = false;
    btnIssue.textContent = '🔒 Issue & Anchor Credential';
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
    });

    loadSampleCredentials('tab-sample-credentials-list', 'tab-credential-input');

    const btnVerify = document.getElementById('tab-btn-run-verify');
    const inputCred = document.getElementById('tab-credential-input');
    if (btnVerify && inputCred) {
      btnVerify.addEventListener('click', () => {
        const val = inputCred.value.trim();
        if (val) verifyCredentialTab(val);
      });
    }
  }
}

// Load Sample Credentials
async function loadSampleCredentials(listContainerId, inputId) {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  try {
    const res = await fetch('/api/credentials');
    const data = await res.json();

    const validCreds = (data.credentials || []).filter(c => c.status !== 'failed');

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
      container.innerHTML = '<span class="pill-label">No credentials found. Click "Issue & Anchor Credential" to create one.</span>';
    }
  } catch (err) {
    container.innerHTML = '<span class="pill-label">Demo offline mode</span>';
  }
}

async function verifyCredentialStandalone(credentialId) {
  await genericVerify(
    credentialId,
    'verification-result',
    'result-status-badge',
    'result-issued-at',
    'result-algo',
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
    'tab-result-anchor-status',
    'tab-result-tx-id',
    'tab-btn-run-verify'
  );
}

// Real Backend Verification Call
async function genericVerify(credentialId, resultPanelId, badgeId, issuedAtId, algoId, anchorStatusId, txId, btnId) {
  const resultPanel = document.getElementById(resultPanelId);
  const statusBadge = document.getElementById(badgeId);
  const issuedAt = document.getElementById(issuedAtId);
  const algoEl = document.getElementById(algoId);
  const anchorStatusEl = document.getElementById(anchorStatusId);
  const txIdEl = document.getElementById(txId);
  const btnVerify = document.getElementById(btnId);

  if (!resultPanel) return;

  if (btnVerify) {
    btnVerify.disabled = true;
    btnVerify.textContent = 'Verifying Backend...';
  }

  try {
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
      if (anchorStatusEl) anchorStatusEl.textContent = `Fabric Anchor (${(verifyData.anchorStatus || 'active').toUpperCase()})`;
      if (txIdEl) txIdEl.textContent = credentialId;
    } else {
      statusBadge.className = 'badge-status-box invalid';
      const failReason = verifyData.reason || verifyData.error || 'Verification failed on backend';
      statusBadge.innerHTML = `<span class="status-icon">✕</span> <span class="status-text">VERIFICATION FAILED: ${failReason}</span>`;

      if (issuedAt) issuedAt.textContent = `Timestamp: ${new Date().toLocaleString()}`;
      if (algoEl) algoEl.textContent = 'ML-DSA-65 Signature Check Failed';
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

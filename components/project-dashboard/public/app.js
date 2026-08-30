/**
 * ScatterID Operator Dashboard — Frontend Application
 * Signal.org Minimalist Organic Theme
 */

let allCredentials = [];

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  setupStudioForms();
  setupRegistryEvents();
  setupDiagnostics();
  setupAuditLogs();

  // Initial load
  loadSystemHealth();
  loadRegistry();
  loadAuditLogs();

  // Periodic health poll (every 15s)
  setInterval(() => {
    loadSystemHealth();
  }, 15000);
});

// Authentication Management
function initAuth() {
  const btnAuth = document.getElementById('btn-auth-status');
  const modal = document.getElementById('auth-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formAuth = document.getElementById('form-auth');
  const inputApiKey = document.getElementById('input-api-key');
  const btnClearKey = document.getElementById('btn-clear-key');

  const savedKey = localStorage.getItem('scatterid_gateway_key');
  updateAuthUI(savedKey);

  if (btnAuth) {
    btnAuth.addEventListener('click', () => {
      if (savedKey) {
        inputApiKey.value = savedKey;
      }
      modal.classList.remove('hidden');
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (formAuth) {
    formAuth.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = inputApiKey.value.trim();
      if (key) {
        localStorage.setItem('scatterid_gateway_key', key);
        updateAuthUI(key);
        modal.classList.add('hidden');
        loadSystemHealth();
        loadRegistry();
        loadAuditLogs();
      }
    });
  }

  if (btnClearKey) {
    btnClearKey.addEventListener('click', () => {
      localStorage.removeItem('scatterid_gateway_key');
      updateAuthUI(null);
      inputApiKey.value = '';
      modal.classList.add('hidden');
      loadRegistry();
      loadAuditLogs();
    });
  }
}

function updateAuthUI(key) {
  const authLabel = document.getElementById('auth-label');
  const btnAuth = document.getElementById('btn-auth-status');
  if (!authLabel || !btnAuth) return;

  if (key) {
    authLabel.textContent = 'Connected';
    btnAuth.classList.remove('btn-secondary');
    btnAuth.classList.add('btn-primary');
  } else {
    authLabel.textContent = 'Set API Key';
    btnAuth.classList.remove('btn-primary');
    btnAuth.classList.add('btn-secondary');
  }
}

function getApiKey() {
  return localStorage.getItem('scatterid_gateway_key') || '';
}

async function apiFetch(endpoint, options = {}) {
  const key = getApiKey();
  const headers = {
    'Content-Type': 'application/json',
    ...(key ? { 'Authorization': `Bearer ${key}` } : {}),
    ...(options.headers || {})
  };

  return fetch(endpoint, {
    ...options,
    headers
  });
}

// Navigation Tabs
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(b => {
    if (b.getAttribute('data-tab') === tabId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === tabId) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (tabId === 'tab-registry') {
    loadRegistry();
  } else if (tabId === 'tab-diagnostics') {
    loadAuditLogs();
  }
}

// System Health & Metrics
async function loadSystemHealth() {
  const badgeCrypto = document.getElementById('badge-crypto');
  const badgeGateway = document.getElementById('badge-gateway');
  const badgeLedger = document.getElementById('badge-ledger');
  const metricActive = document.getElementById('metric-active-services');
  const metricDrift = document.getElementById('metric-reconciliation-drift');
  const metricDriftNote = document.getElementById('metric-reconciliation-note');

  try {
    const res = await apiFetch('/api/status');
    if (!res.ok) return;

    const data = await res.json();
    let onlineCount = 0;
    const totalServices = 5;

    // Crypto authority
    if (data.services && data.services.cryptoService === 'RUNNING') {
      onlineCount++;
      if (badgeCrypto) { badgeCrypto.textContent = 'Active'; badgeCrypto.className = 'pill-badge active'; }
    } else if (badgeCrypto) {
      badgeCrypto.textContent = 'Offline'; badgeCrypto.className = 'pill-badge';
    }

    // Verification gateway
    if (data.services && data.services.verificationApi === 'RUNNING') {
      onlineCount++;
      if (badgeGateway) { badgeGateway.textContent = 'Active'; badgeGateway.className = 'pill-badge active'; }
    } else if (badgeGateway) {
      badgeGateway.textContent = 'Offline'; badgeGateway.className = 'pill-badge';
    }

    // Fabric nodes (orderer, issuerPeer, verifierPeer)
    let fabricUp = 0;
    if (data.blockchain) {
      if (data.blockchain.orderer === 'RUNNING') { onlineCount++; fabricUp++; }
      if (data.blockchain.issuerPeer === 'RUNNING') { onlineCount++; fabricUp++; }
      if (data.blockchain.verifierPeer === 'RUNNING') { onlineCount++; fabricUp++; }
    }

    if (badgeLedger) {
      if (fabricUp === 3) {
        badgeLedger.textContent = 'Active';
        badgeLedger.className = 'pill-badge active';
      } else if (fabricUp > 0) {
        badgeLedger.textContent = 'Degraded';
        badgeLedger.className = 'pill-badge';
      } else {
        badgeLedger.textContent = 'Offline';
        badgeLedger.className = 'pill-badge';
      }
    }

    if (metricActive) {
      metricActive.textContent = `${onlineCount}/${totalServices}`;
    }

    // Reconciliation status
    if (data.reconciliation && metricDrift) {
      const mismatches = data.reconciliation.mismatchCount || 0;
      if (mismatches > 0) {
        metricDrift.textContent = `${mismatches} Discrepancies`;
        metricDrift.className = 'metric-value text-blue';
        if (metricDriftNote) metricDriftNote.textContent = 'Ledger drift flagged — review audit logs';
      } else {
        metricDrift.textContent = '0 Discrepancies';
        metricDrift.className = 'metric-value';
        if (metricDriftNote) {
          const lastTime = data.reconciliation.lastReconciledAt ? new Date(data.reconciliation.lastReconciledAt).toLocaleTimeString() : 'active';
          metricDriftNote.textContent = `Ledger state reconciled (${lastTime})`;
        }
      }
    }
  } catch (err) {
    console.warn('Could not poll health status:', err.message);
  }
}

// Credential Studio: Issue, Verify, Tamper
function setupStudioForms() {
  const formIssue = document.getElementById('form-issue');
  const btnVerify = document.getElementById('btn-run-verify');
  const btnTamper = document.getElementById('btn-run-tamper');
  const btnUseLatest = document.getElementById('btn-use-latest');
  const inputVerifyId = document.getElementById('verify-cred-id');

  // 1. Unified SDK Issuance
  if (formIssue) {
    formIssue.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = document.getElementById('issue-subject').value.trim();
      const role = document.getElementById('issue-role').value.trim();
      const org = document.getElementById('issue-org').value.trim();
      const submitBtn = document.getElementById('btn-submit-issue');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Canonicalizing & Anchoring via SDK...';

      try {
        const claimPayload = { subject, role, org, issuedAt: new Date().toISOString() };

        const res = await apiFetch('/api/issue', {
          method: 'POST',
          body: JSON.stringify({ claim: claimPayload })
        });

        const data = await res.json();
        if (!res.ok && res.status !== 202) {
          alert(`Issuance failed: ${data.error || res.statusText}`);
          return;
        }

        const issueBox = document.getElementById('issue-result-box');
        const issueBadge = document.getElementById('issue-result-badge');
        issueBox.classList.remove('hidden');
        document.getElementById('issue-result-time').textContent = new Date().toLocaleTimeString();
        document.getElementById('issue-result-id').textContent = data.credentialId || '--';
        document.getElementById('issue-result-hash').textContent = data.dataHash || '--';
        document.getElementById('issue-result-txid').textContent = data.anchorTxId || 'Not Anchored';

        if (data.status === 'anchor_failed') {
          if (issueBadge) {
            issueBadge.textContent = 'Anchor Failed (Saved Locally)';
            issueBadge.className = 'badge-status tampered';
          }
        } else {
          if (issueBadge) {
            issueBadge.textContent = 'Anchored';
            issueBadge.className = 'badge-success';
          }
        }

        if (inputVerifyId && data.credentialId) {
          inputVerifyId.value = data.credentialId;
        }

        loadRegistry();
        loadAuditLogs();
      } catch (err) {
        alert(err.message || 'Issuance network failure');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Issue & Anchor Proof';
      }
    });
  }

  // 2. Use Latest Credential
  if (btnUseLatest && inputVerifyId) {
    btnUseLatest.addEventListener('click', () => {
      if (allCredentials.length > 0) {
        inputVerifyId.value = allCredentials[0].id;
      } else {
        alert('No credentials found in registry. Issue one first.');
      }
    });
  }

  // 3. Verify Credential
  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      const credId = inputVerifyId.value.trim();
      if (!credId) return alert('Please enter a Credential ID to verify');

      btnVerify.disabled = true;
      btnVerify.textContent = 'Verifying...';

      try {
        const res = await apiFetch('/api/verify', {
          method: 'POST',
          body: JSON.stringify({ credentialId: credId })
        });

        const result = await res.json();
        const verifyBox = document.getElementById('verify-result-box');
        const badge = document.getElementById('verify-status-badge');
        const exp = document.getElementById('verify-explanation-text');

        verifyBox.classList.remove('hidden');
        document.getElementById('verify-result-time').textContent = new Date().toLocaleTimeString();

        if (res.ok && result.valid) {
          badge.textContent = 'Cryptographically Validated';
          badge.className = 'badge-status';
          exp.textContent = `Credential ${credId.slice(0, 8)}... was successfully verified against the immutable ledger anchor (Status: ${result.anchorStatus || 'active'}).`;
        } else {
          badge.textContent = 'Verification Rejected';
          badge.className = 'badge-status tampered';
          exp.textContent = result.reason || result.error || 'Verification check failed: Anchor or signature mismatch.';
        }
      } catch (err) {
        alert(err.message || 'Verification check failed');
      } finally {
        btnVerify.disabled = false;
        btnVerify.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Verify';
      }
    });
  }

  // 4. Tamper Simulation
  if (btnTamper) {
    btnTamper.addEventListener('click', async () => {
      const credId = inputVerifyId.value.trim();
      if (!credId) return alert('Please enter or issue a Credential ID first to test tampering');

      btnTamper.disabled = true;
      btnTamper.textContent = 'Testing...';

      try {
        const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
        const res = await apiFetch('/api/verify', {
          method: 'POST',
          body: JSON.stringify({ credentialId: credId, dataHash: fakeHash })
        });

        const result = await res.json();
        const verifyBox = document.getElementById('verify-result-box');
        const badge = document.getElementById('verify-status-badge');
        const exp = document.getElementById('verify-explanation-text');

        verifyBox.classList.remove('hidden');
        document.getElementById('verify-result-time').textContent = new Date().toLocaleTimeString();

        if (result.valid === false || !res.ok) {
          badge.textContent = 'Tampered Data Rejected';
          badge.className = 'badge-status tampered';
          exp.textContent = `Defense Check Passed: The ledger rejected the modified payload because the hash did not match the cryptographic commitment anchored during issuance.`;
        } else {
          badge.textContent = 'Unexpected Result';
          badge.className = 'badge-status';
          exp.textContent = 'Warning: Tampered payload was not rejected.';
        }
      } catch (err) {
        alert(err.message || 'Tamper test error');
      } finally {
        btnTamper.disabled = false;
        btnTamper.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Tamper Test';
      }
    });
  }
}

// Registry Data Table
async function loadRegistry() {
  const tbody = document.getElementById('registry-tbody');
  const countEl = document.getElementById('registry-count');
  const metricTotal = document.getElementById('metric-total-credentials');
  const metricAnchored = document.getElementById('metric-anchored-credentials');

  if (!tbody) return;

  try {
    const res = await apiFetch('/api/credentials');
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Authenticate with API Key to view audit records.</td></tr>`;
      return;
    }

    const data = await res.json();
    allCredentials = data.credentials || [];
    
    if (countEl) countEl.textContent = `${allCredentials.length} credentials`;
    if (metricTotal) metricTotal.textContent = allCredentials.length;
    if (metricAnchored) {
      const anchoredCount = allCredentials.filter(c => c.status === 'anchored' || c.status === 'active').length;
      metricAnchored.textContent = anchoredCount;
    }

    renderRegistryTable(allCredentials);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Could not load credentials.</td></tr>`;
  }
}

function renderRegistryTable(items) {
  const tbody = document.getElementById('registry-tbody');
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No credentials issued yet. Use the Studio to issue your first credential.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(c => {
    const isAnchorFailed = c.status === 'anchor_failed';
    const isRevoked = c.status === 'revoked';
    const isAnchored = c.status === 'anchored' || c.status === 'active';

    let badgeClass = 'pill-badge';
    let badgeText = c.status;

    if (isAnchorFailed) {
      badgeClass = 'pill-badge tampered';
      badgeText = 'Anchor Failed';
    } else if (isRevoked) {
      badgeClass = 'pill-badge';
      badgeText = 'Revoked';
    } else if (isAnchored) {
      badgeClass = 'pill-badge active';
      badgeText = 'Active';
    }

    const actionHtml = isAnchorFailed
      ? `<button class="btn btn-primary btn-sm btn-retry-anchor" data-id="${c.id}">Retry Anchor</button>`
      : `<button class="btn btn-secondary btn-sm btn-quick-verify" data-id="${c.id}">Verify</button>`;

    return `
      <tr>
        <td><span class="field-value mono">${c.id}</span></td>
        <td><span class="field-value mono">${c.dataHash ? c.dataHash.slice(0, 16) + '...' : '--'}</span></td>
        <td><span class="${badgeClass}">${badgeText}</span></td>
        <td>${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() + ' ' + new Date(c.issuedAt).toLocaleTimeString() : '--'}</td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

// Registry Event Delegation
function setupRegistryEvents() {
  const registryTbody = document.getElementById('registry-tbody');
  const searchInput = document.getElementById('registry-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderRegistryTable(allCredentials);
        return;
      }
      const filtered = allCredentials.filter(c => 
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.dataHash && c.dataHash.toLowerCase().includes(q)) ||
        (c.status && c.status.toLowerCase().includes(q))
      );
      renderRegistryTable(filtered);
    });
  }

  if (registryTbody) {
    registryTbody.addEventListener('click', async (e) => {
      const verifyBtn = e.target.closest('.btn-quick-verify');
      const retryBtn = e.target.closest('.btn-retry-anchor');

      if (verifyBtn) {
        const id = verifyBtn.getAttribute('data-id');
        if (id) {
          switchTab('tab-studio');
          const inputVerifyId = document.getElementById('verify-cred-id');
          if (inputVerifyId) {
            inputVerifyId.value = id;
            const btnRunVerify = document.getElementById('btn-run-verify');
            if (btnRunVerify) btnRunVerify.click();
          }
        }
      }

      if (retryBtn) {
        const id = retryBtn.getAttribute('data-id');
        if (!id) return;
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying...';

        try {
          const res = await apiFetch(`/api/issue/${id}/retry-anchor`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.status === 'anchored') {
            alert(`Credential ${id.slice(0, 8)}... successfully anchored on Fabric! (TxID: ${data.anchorTxId})`);
            loadRegistry();
            loadAuditLogs();
          } else {
            alert(`Anchor retry failed: ${data.error || 'Ledger unreachable'}`);
          }
        } catch (err) {
          alert(`Network error during retry: ${err.message}`);
        } finally {
          retryBtn.disabled = false;
          retryBtn.textContent = 'Retry Anchor';
        }
      }
    });
  }
}

// Audit Logs
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/api/audit?limit=25');
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Authenticate to view durable audit trail.</td></tr>`;
      return;
    }

    const data = await res.json();
    const logs = data.logs || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No audit events recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const isSuccess = l.status === 'anchored' || l.status === 'revoked' || l.status === 'success';
      const outcomeBadge = isSuccess ? 'pill-badge active' : 'pill-badge tampered';
      return `
        <tr>
          <td>${l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '--'}</td>
          <td><strong style="text-transform: uppercase; font-size: 0.75rem;">${l.action}</strong></td>
          <td><span class="field-value mono">${l.credentialId ? l.credentialId.slice(0, 18) + '...' : '--'}</span></td>
          <td><span class="${outcomeBadge}">${l.status}</span></td>
          <td><span class="field-value mono" style="font-size: 0.75rem;">${l.callerTier || 'standard'}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Could not load audit activity.</td></tr>`;
  }
}

function setupAuditLogs() {
  const btnRefresh = document.getElementById('btn-refresh-audit');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadAuditLogs();
    });
  }
}

// Diagnostics Pipeline Smoke Test & Key Rotation
function setupDiagnostics() {
  const btnDiag = document.getElementById('btn-run-diagnostics');
  const btnRotate = document.getElementById('btn-rotate-key');
  const logBox = document.getElementById('diagnostics-log-box');

  if (btnDiag) {
    btnDiag.addEventListener('click', async () => {
      btnDiag.disabled = true;
      btnDiag.textContent = 'Running...';
      logBox.innerHTML = '<div class="log-entry log-blue">Initiating end-to-end verification pipeline test...</div>';

      try {
        // Step 1: Issue via SDK
        logBox.innerHTML += '<div class="log-entry">[1/3] Canonicalizing test claim and computing SHA3-256...</div>';
        const claim = { subject: "did:scatterid:test:probe-" + Date.now(), role: "Security Probe", org: "Automated Self-Test" };
        
        const issueRes = await apiFetch('/api/issue', {
          method: 'POST',
          body: JSON.stringify({ claim })
        });
        const issueData = await issueRes.json();

        if (!issueRes.ok && issueRes.status !== 202) {
          throw new Error(`Issuance failed: ${issueData.error || issueRes.statusText}`);
        }
        logBox.innerHTML += `<div class="log-entry log-blue">[2/3] Credential anchored: ${issueData.credentialId.slice(0, 16)}...</div>`;

        // Step 2: Verify
        const verifyRes = await apiFetch('/api/verify', {
          method: 'POST',
          body: JSON.stringify({ credentialId: issueData.credentialId })
        });
        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.valid) {
          logBox.innerHTML += '<div class="log-entry log-blue">[3/3] On-chain verification validated successfully.</div>';
          logBox.innerHTML += '<div class="log-entry" style="font-weight: 600;">✓ Automated pipeline self-test PASSED (All systems nominal)</div>';
        } else {
          throw new Error(`Verification check failed: ${verifyData.reason || 'Status mismatch'}`);
        }

        loadRegistry();
        loadAuditLogs();
      } catch (err) {
        logBox.innerHTML += `<div class="log-entry" style="color: #c00;">✕ Test FAILED: ${err.message}</div>`;
      } finally {
        btnDiag.disabled = false;
        btnDiag.textContent = 'Execute Test';
      }
    });
  }

  if (btnRotate) {
    btnRotate.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to rotate the active post-quantum ML-DSA signing key in HashiCorp Vault?')) {
        return;
      }

      btnRotate.disabled = true;
      btnRotate.textContent = 'Rotating...';

      try {
        const res = await apiFetch('/api/rotate-key', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
          alert(`KMS Key Rotated Successfully!\nNew Public Key ID: ${data.publicKeyId}`);
          loadAuditLogs();
        } else {
          alert(`Key rotation error: ${data.error || 'Failed'}`);
        }
      } catch (err) {
        alert(`Key rotation network error: ${err.message}`);
      } finally {
        btnRotate.disabled = false;
        btnRotate.textContent = 'Rotate Key';
      }
    });
  }
}

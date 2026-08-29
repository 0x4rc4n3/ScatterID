/**
 * ScatterID Operator Console — Minimalist Client Application (Signal.org Theme)
 */

// State
let apiKey = sessionStorage.getItem('scatterid_gateway_key') || '';
let latestCredentialId = '';
let allCredentials = [];

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const authModal = document.getElementById('auth-modal');
const inputApiKey = document.getElementById('input-api-key');
const authStatusDot = document.getElementById('auth-status-dot');
const authBtnText = document.getElementById('auth-btn-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupAuthModal();
  updateAuthUI();
  fetchHealthOverview();
  loadRegistry();
  setupStudioForms();
  setupDiagnostics();
});

// Helper: API Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
      promptApiKeyModal();
      throw new Error('Unauthorized: Please set your Operator API Key');
    }
    return res;
  } catch (err) {
    console.error(`API Fetch error on ${endpoint}:`, err);
    throw err;
  }
}

// Navigation Tabs
function setupNavigation() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  const btnGotoStudio = document.getElementById('btn-goto-studio');
  if (btnGotoStudio) {
    btnGotoStudio.addEventListener('click', () => switchTab('tab-studio'));
  }

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchHealthOverview();
      loadRegistry();
    });
  }

  // Handle URL hash routing
  if (window.location.hash) {
    const hashTab = `tab-${window.location.hash.replace('#', '')}`;
    if (document.getElementById(hashTab)) {
      switchTab(hashTab);
    }
  }
}

function switchTab(tabId) {
  navBtns.forEach(b => {
    if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    else b.classList.remove('active');
  });

  tabContents.forEach(c => {
    if (c.id === tabId) c.classList.add('active');
    else c.classList.remove('active');
  });

  if (tabId === 'tab-registry') loadRegistry();
}

// Auth Key Management
function setupAuthModal() {
  const btnAuth = document.getElementById('btn-auth-settings');
  const btnClose = document.getElementById('btn-close-auth-modal');
  const btnSave = document.getElementById('btn-save-key');
  const btnClear = document.getElementById('btn-clear-key');

  if (btnAuth) btnAuth.addEventListener('click', () => {
    inputApiKey.value = apiKey;
    authModal.classList.remove('hidden');
  });

  if (btnClose) btnClose.addEventListener('click', () => authModal.classList.add('hidden'));

  if (btnSave) btnSave.addEventListener('click', () => {
    apiKey = inputApiKey.value.trim();
    if (apiKey) {
      sessionStorage.setItem('scatterid_gateway_key', apiKey);
    } else {
      sessionStorage.removeItem('scatterid_gateway_key');
    }
    authModal.classList.add('hidden');
    updateAuthUI();
    fetchHealthOverview();
  });

  if (btnClear) btnClear.addEventListener('click', () => {
    apiKey = '';
    inputApiKey.value = '';
    sessionStorage.removeItem('scatterid_gateway_key');
    authModal.classList.add('hidden');
    updateAuthUI();
  });
}

function promptApiKeyModal() {
  inputApiKey.value = apiKey;
  authModal.classList.remove('hidden');
}

function updateAuthUI() {
  if (apiKey) {
    authStatusDot.style.background = '#2C6BED';
    authBtnText.textContent = 'Connected';
  } else {
    authStatusDot.style.background = '#888888';
    authBtnText.textContent = 'Set Key';
  }
}

// Health Overview
async function fetchHealthOverview() {
  try {
    const res = await apiFetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();

    const badgeCrypto = document.getElementById('badge-crypto');
    const badgeGateway = document.getElementById('badge-gateway');
    const badgeLedger = document.getElementById('badge-ledger');

    if (data.services?.cryptoService === 'RUNNING') {
      badgeCrypto.textContent = 'Active';
      badgeCrypto.classList.add('active');
    }
    if (data.services?.verificationApi === 'RUNNING') {
      badgeGateway.textContent = 'Active';
      badgeGateway.classList.add('active');
    }
    if (data.blockchain?.orderer === 'RUNNING') {
      badgeLedger.textContent = 'Active';
      badgeLedger.classList.add('active');
    }
  } catch (err) {
    // If not authenticated or error
  }
}

// Credential Studio: Issue, Verify & Tamper
function setupStudioForms() {
  const formIssue = document.getElementById('form-issue');
  const btnVerify = document.getElementById('btn-run-verify');
  const btnTamper = document.getElementById('btn-run-tamper');
  const btnUseLatest = document.getElementById('btn-use-latest');
  const inputVerifyId = document.getElementById('verify-cred-id');

  // Issue Credential
  if (formIssue) {
    formIssue.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = document.getElementById('issue-subject').value.trim();
      const role = document.getElementById('issue-role').value.trim();
      const org = document.getElementById('issue-org').value.trim();
      const submitBtn = document.getElementById('btn-submit-issue');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Computing Hash & Anchoring...';

      try {
        // Compute SHA-256 hash commitment on client side
        const claimPayload = { subject, role, org, timestamp: new Date().toISOString() };
        const canonical = JSON.stringify(claimPayload, Object.keys(claimPayload).sort());
        const enc = new TextEncoder().encode(canonical);
        const hashBuf = await crypto.subtle.digest('SHA-256', enc);
        const dataHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        const res = await apiFetch('/api/issue', {
          method: 'POST',
          body: JSON.stringify({ dataHash })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(`Issuance failed: ${errData.error || res.statusText}`);
          return;
        }

        const result = await res.json();
        latestCredentialId = result.credentialId;
        inputVerifyId.value = latestCredentialId;

        // Display Result Box
        const resultBox = document.getElementById('issue-result-box');
        document.getElementById('issue-result-id').textContent = result.credentialId;
        document.getElementById('issue-result-hash').textContent = dataHash;
        document.getElementById('issue-result-txid').textContent = result.anchorTxId || 'Pending Block Consensus';
        document.getElementById('issue-result-time').textContent = new Date().toLocaleTimeString();
        resultBox.classList.remove('hidden');

        loadRegistry();
      } catch (err) {
        alert(err.message || 'Issuance failed');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Issue & Anchor Credential';
      }
    });
  }

  // Use Latest Button
  if (btnUseLatest) {
    btnUseLatest.addEventListener('click', () => {
      if (latestCredentialId) inputVerifyId.value = latestCredentialId;
    });
  }

  // Verify
  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      const credId = inputVerifyId.value.trim();
      if (!credId) return alert('Please enter a Credential ID');

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
        btnVerify.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Verify Proof';
      }
    });
  }

  // Tamper Simulation
  if (btnTamper) {
    btnTamper.addEventListener('click', async () => {
      const credId = inputVerifyId.value.trim();
      if (!credId) return alert('Please enter or issue a Credential ID first to test tampering');

      btnTamper.disabled = true;
      btnTamper.textContent = 'Testing Tamper Defense...';

      try {
        // Send a modified fake hash
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
        btnTamper.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Test Tamper Defense';
      }
    });
  }
}

// Credentials Registry
async function loadRegistry() {
  const tbody = document.getElementById('registry-tbody');
  const countEl = document.getElementById('registry-count');
  const metricTotal = document.getElementById('metric-total-credentials');

  try {
    const res = await apiFetch('/api/credentials');
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Authentication required to view registry records.</td></tr>`;
      return;
    }

    const data = await res.json();
    allCredentials = data.credentials || [];
    
    if (countEl) countEl.textContent = `${allCredentials.length} credentials`;
    if (metricTotal) metricTotal.textContent = allCredentials.length;

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

  tbody.innerHTML = items.map(c => `
    <tr>
      <td><span class="field-value mono">${c.id}</span></td>
      <td><span class="field-value mono">${c.dataHash ? c.dataHash.slice(0, 16) + '...' : '--'}</span></td>
      <td><span class="pill-badge ${c.status === 'anchored' ? 'active' : ''}">${c.status || 'Active'}</span></td>
      <td>${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() + ' ' + new Date(c.issuedAt).toLocaleTimeString() : '--'}</td>
      <td>
        <button class="btn btn-secondary btn-sm btn-quick-verify" data-id="${c.id}">Verify</button>
      </td>
    </tr>
  `).join('');
}

// Global Quick Verify & Event Delegation
function quickVerify(id) {
  switchTab('tab-studio');
  const inputVerifyId = document.getElementById('verify-cred-id');
  if (inputVerifyId) {
    inputVerifyId.value = id;
    const btnRunVerify = document.getElementById('btn-run-verify');
    if (btnRunVerify) btnRunVerify.click();
  }
}

// Attach table event delegation for CSP compliance (no inline onclick attributes)
const registryTbody = document.getElementById('registry-tbody');
if (registryTbody) {
  registryTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-quick-verify');
    if (btn) {
      const id = btn.getAttribute('data-id');
      if (id) quickVerify(id);
    }
  });
}

// Search filtering in Registry
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
      (c.dataHash && c.dataHash.toLowerCase().includes(q))
    );
    renderRegistryTable(filtered);
  });
}

// Diagnostics & Key Rotation
function setupDiagnostics() {
  const btnRunDiag = document.getElementById('btn-run-diagnostics');
  const btnRotate = document.getElementById('btn-rotate-key');
  const logBox = document.getElementById('diagnostics-log-box');

  if (btnRunDiag) {
    btnRunDiag.addEventListener('click', async () => {
      btnRunDiag.disabled = true;
      btnRunDiag.textContent = 'Testing Pipeline...';
      logBox.innerHTML = '<div class="log-entry log-blue">[1/5] Initiating automated self-test...</div>';

      try {
        const res = await apiFetch('/api/diagnostics/run', { method: 'POST' });
        const data = await res.json();
        
        logBox.innerHTML = '';
        if (data.logs && Array.isArray(data.logs)) {
          data.logs.forEach(l => {
            const entry = document.createElement('div');
            entry.className = `log-entry ${l.status === 'success' ? 'log-blue' : ''}`;
            entry.textContent = `[${l.step}] ${l.detail}`;
            logBox.appendChild(entry);
          });
        }

        const finalEntry = document.createElement('div');
        finalEntry.className = 'log-entry log-blue';
        finalEntry.textContent = data.success ? '✓ All pipeline tests passed successfully.' : '✕ Diagnostic check found issues.';
        logBox.appendChild(finalEntry);
      } catch (err) {
        logBox.innerHTML += `<div class="log-entry">Error: ${err.message}</div>`;
      } finally {
        btnRunDiag.disabled = false;
        btnRunDiag.textContent = 'Run Test';
      }
    });
  }

  if (btnRotate) {
    btnRotate.addEventListener('click', async () => {
      if (!confirm('Rotate the active signing key in HashiCorp Vault KMS? Existing credentials will continue to verify.')) return;
      btnRotate.disabled = true;
      btnRotate.textContent = 'Rotating...';

      try {
        const res = await apiFetch('/api/settings/rotate', { method: 'POST' });
        const data = await res.json();
        if (res.ok && (data.success || data.message || data.publicKeyId)) {
          const keyMsg = data.publicKeyId ? `\nNew Public Key ID: ${data.publicKeyId}` : '';
          alert(`Signing key rotated successfully in Vault KMS.${keyMsg}`);
        } else {
          alert(`Key rotation error: ${data.error || data.message || 'Failed'}`);
        }
      } catch (err) {
        alert(err.message || 'Key rotation failed');
      } finally {
        btnRotate.disabled = false;
        btnRotate.textContent = 'Rotate Key';
      }
    });
  }
}

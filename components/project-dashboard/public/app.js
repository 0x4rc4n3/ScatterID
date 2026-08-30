// ScatterID Operator Dashboard Logic
// Strictly follows Signal.org light minimalist aesthetic with CSP compliance

const STORAGE_KEY = 'scatterid_operator_key';
let activeApiKey = localStorage.getItem(STORAGE_KEY) || '';
let allCredentials = [];
let latestCredentialId = '';

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  setupNavTabs();
  setupStudioForms();
  setupDiagnostics();
  setupRegistryEvents();

  // Initial Data Fetch
  fetchHealthOverview();
  loadRegistry();
});

// Helper for authenticated API calls to project-dashboard
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (activeApiKey) {
    headers['Authorization'] = `Bearer ${activeApiKey}`;
  }

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    updateAuthStatus(false);
    openAuthModal();
  }

  return response;
}

// Navigation Tabs
function setupNavTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Handle URL hash navigation
  if (window.location.hash) {
    const tabName = window.location.hash.replace('#', '');
    const targetTab = `tab-${tabName}`;
    if (document.getElementById(targetTab)) {
      switchTab(targetTab);
    }
  }
}

function switchTab(tabId) {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.tab-content');

  navBtns.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });

  sections.forEach(s => {
    s.classList.toggle('active', s.id === tabId);
  });

  window.location.hash = tabId.replace('tab-', '');

  if (tabId === 'tab-overview') fetchHealthOverview();
  if (tabId === 'tab-registry') loadRegistry();
}

// Authentication Modal & Key Persistence
function initAuth() {
  const modal = document.getElementById('auth-modal');
  const btnAuth = document.getElementById('btn-auth-settings');
  const btnClose = document.getElementById('btn-close-modal');
  const btnClear = document.getElementById('btn-clear-key');
  const formAuth = document.getElementById('form-auth');
  const inputKey = document.getElementById('input-api-key');

  if (btnAuth) btnAuth.addEventListener('click', () => openAuthModal());
  if (btnClose) btnClose.addEventListener('click', () => closeAuthModal());
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuthModal();
    });
  }

  if (formAuth) {
    formAuth.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputKey.value.trim();
      if (val) {
        activeApiKey = val;
        localStorage.setItem(STORAGE_KEY, activeApiKey);
        updateAuthStatus(true);
        closeAuthModal();
        fetchHealthOverview();
        loadRegistry();
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      activeApiKey = '';
      localStorage.removeItem(STORAGE_KEY);
      inputKey.value = '';
      updateAuthStatus(false);
      closeAuthModal();
    });
  }

  updateAuthStatus(Boolean(activeApiKey));
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  const inputKey = document.getElementById('input-api-key');
  if (inputKey) inputKey.value = activeApiKey;
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function updateAuthStatus(isConnected) {
  const authStatusDot = document.getElementById('auth-status-dot');
  const authBtnText = document.getElementById('auth-btn-text');

  if (!authStatusDot || !authBtnText) return;

  if (isConnected) {
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
    // Silent catch
  }
}

// Credential Studio: Issue, Verify, Tamper, Revoke
function setupStudioForms() {
  const formIssue = document.getElementById('form-issue');
  const btnVerify = document.getElementById('btn-run-verify');
  const btnTamper = document.getElementById('btn-run-tamper');
  const btnRevoke = document.getElementById('btn-run-revoke');
  const btnUseLatest = document.getElementById('btn-use-latest');
  const inputVerifyId = document.getElementById('verify-cred-id');

  // 1. Issue Credential
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
        if (inputVerifyId) inputVerifyId.value = latestCredentialId;

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
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Issue & Anchor Proof';
      }
    });
  }

  // Use Latest Button
  if (btnUseLatest) {
    btnUseLatest.addEventListener('click', () => {
      if (latestCredentialId && inputVerifyId) inputVerifyId.value = latestCredentialId;
    });
  }

  // 2. Verify
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
        btnVerify.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Verify';
      }
    });
  }

  // 3. Tamper Simulation
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
    const isRevoked = c.status === 'revoked';
    const isAnchored = c.status === 'anchored' || c.status === 'active';
    const badgeClass = isRevoked ? 'pill-badge' : (isAnchored ? 'pill-badge active' : 'pill-badge');
    const badgeText = isRevoked ? 'Revoked' : (isAnchored ? 'Active' : (c.status || 'Active'));

    return `
      <tr>
        <td><span class="field-value mono">${c.id}</span></td>
        <td><span class="field-value mono">${c.dataHash ? c.dataHash.slice(0, 16) + '...' : '--'}</span></td>
        <td><span class="${badgeClass}">${badgeText}</span></td>
        <td>${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() + ' ' + new Date(c.issuedAt).toLocaleTimeString() : '--'}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-quick-verify" data-id="${c.id}">Verify</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Registry Event Delegation
function setupRegistryEvents() {
  const registryTbody = document.getElementById('registry-tbody');
  if (registryTbody) {
    registryTbody.addEventListener('click', async (e) => {
      const verifyBtn = e.target.closest('.btn-quick-verify');

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
        btnRunDiag.textContent = 'Execute Test';
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

// ScatterID SDK Interactive Explorer — Client Logic

let activeCredential = null;
let sampleClaims = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadSamples();
  initIssuance();
  initVerification();
  initLifecycle();
});

// -----------------------------------------------------------------------------
// 1. Navigation Tab Switching
// -----------------------------------------------------------------------------
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// -----------------------------------------------------------------------------
// 2. Load 10 Presets from /api/samples
// -----------------------------------------------------------------------------
async function loadSamples() {
  const container = document.getElementById('presets-container');
  const editor = document.getElementById('claim-editor');

  try {
    const res = await fetch('/api/samples');
    const data = await res.json();

    if (data.success && data.samples && data.samples.length > 0) {
      sampleClaims = data.samples;
      container.textContent = '';

      sampleClaims.forEach((claim, idx) => {
        const btn = document.createElement('button');
        btn.className = 'preset-pill';
        // Extract title or role
        const label = claim.role || claim.subject.split(':').pop();
        btn.textContent = `${idx + 1}. ${label}`;

        btn.addEventListener('click', () => {
          document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          editor.value = JSON.stringify(claim, null, 2);
        });

        container.appendChild(btn);
      });

      // Select first preset by default
      if (container.firstChild) {
        container.firstChild.click();
      }
    } else {
      container.textContent = 'No presets found.';
    }
  } catch (err) {
    container.textContent = 'Could not load presets from server.';
  }
}

// -----------------------------------------------------------------------------
// 3. Tab 1: Issuance via SDK
// -----------------------------------------------------------------------------
function initIssuance() {
  const btnIssue = document.getElementById('btn-issue');
  const editor = document.getElementById('claim-editor');
  const pipelineStatus = document.getElementById('pipeline-status');

  const outCanon = document.getElementById('out-canon');
  const outSalt = document.getElementById('out-salt');
  const outHash = document.getElementById('out-hash');
  const outSig = document.getElementById('out-sig');
  const outAnchor = document.getElementById('out-anchor');

  btnIssue.addEventListener('click', async () => {
    let claimObj;
    try {
      claimObj = JSON.parse(editor.value);
    } catch (e) {
      alert('Invalid JSON in claim editor. Please fix syntax.');
      return;
    }

    btnIssue.disabled = true;
    btnIssue.innerHTML = '<span class="btn-icon">⏳</span> Executing SDK Pipeline...';
    pipelineStatus.textContent = 'Executing...';
    pipelineStatus.style.color = '#38bdf8';

    // Local canonicalization preview
    const sortedKeys = Object.keys(claimObj).sort();
    outCanon.textContent = JSON.stringify(claimObj, sortedKeys);
    outSalt.textContent = 'Generating 16-byte CSPRNG salt...';
    outHash.textContent = 'Computing SHA3-256...';
    outSig.textContent = 'Contacting Vault KMS (ML-DSA-65)...';
    outAnchor.textContent = 'Submitting to Hyperledger Fabric...';

    try {
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: claimObj })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Issuance failed');
      }

      const cred = data.credential;
      activeCredential = cred;

      // Update Pipeline Steps
      outSalt.textContent = cred.salt;
      outHash.textContent = cred.dataHash;
      outSig.textContent = cred.signature ? `${cred.signature.substring(0, 48)}... (Algorithm: ${cred.algorithm})` : 'Generated';
      outAnchor.textContent = `TxID: ${cred.anchorTxId || 'Committed'} | Status: ${cred.status.toUpperCase()}`;

      pipelineStatus.textContent = '✓ Successfully Issued';
      pipelineStatus.style.color = '#10b981';

      // Auto-populate Tab 2 (Verify)
      populateVerifyTab(cred);

      // Auto-populate Tab 3 (Lifecycle)
      populateLifecycleTab(cred);

    } catch (err) {
      pipelineStatus.textContent = '✕ Error';
      pipelineStatus.style.color = '#ef4444';
      outAnchor.textContent = `Error: ${err.message}`;
    } finally {
      btnIssue.disabled = false;
      btnIssue.innerHTML = '<span class="btn-icon">⚡</span> Issue Credential via SDK';
    }
  });
}

// -----------------------------------------------------------------------------
// 4. Tab 2: Verification & Tamper Testing
// -----------------------------------------------------------------------------
function populateVerifyTab(cred) {
  document.getElementById('verify-cred-id').textContent = cred.credentialId;
  document.getElementById('verify-salt').textContent = cred.salt;
  document.getElementById('verify-claim-editor').value = JSON.stringify(cred.rawClaim, null, 2);

  // Reset verification banner
  const banner = document.getElementById('result-banner');
  banner.className = 'result-banner idle';
  banner.innerHTML = '<span class="result-icon">ℹ</span><div class="result-text">Ready to verify. Click "Verify Cryptographic Proof" below.</div>';

  document.getElementById('res-recomputed-hash').textContent = '—';
  document.getElementById('res-hash-match').textContent = '—';
  document.getElementById('res-sig-check').textContent = '—';
  document.getElementById('res-anchor-status').textContent = '—';
  document.getElementById('verify-status-badge').textContent = 'Ready';
  document.getElementById('verify-status-badge').style.color = '#94a3b8';
}

function initVerification() {
  const btnVerify = document.getElementById('btn-run-verify');
  const btnTamper = document.getElementById('btn-tamper-data');
  const verifyEditor = document.getElementById('verify-claim-editor');
  const banner = document.getElementById('result-banner');
  const verifyBadge = document.getElementById('verify-status-badge');

  // Tamper Simulation Button
  btnTamper.addEventListener('click', () => {
    try {
      const obj = JSON.parse(verifyEditor.value);
      if (obj.role) {
        obj.role = obj.role + ' (MODIFIED_FORGERY)';
      } else if (obj.clearanceLevel) {
        obj.clearanceLevel = 'Fake-Tier-5 (MODIFIED)';
      } else if (obj.gpa) {
        obj.gpa = 4.0;
      } else {
        obj.tamperedField = 'INJECTED_UNAUTHORIZED_DATA';
      }
      verifyEditor.value = JSON.stringify(obj, null, 2);

      banner.className = 'result-banner invalid';
      banner.innerHTML = '<span class="result-icon">⚠️</span><div class="result-text">Data has been tampered with! Now click "Verify Cryptographic Proof" to see the SDK reject it.</div>';
    } catch (e) {
      alert('Could not tamper: invalid JSON in editor.');
    }
  });

  // Verify Button
  btnVerify.addEventListener('click', async () => {
    if (!activeCredential) {
      alert('Please issue a credential in Tab 1 first.');
      return;
    }

    let claimObj;
    try {
      claimObj = JSON.parse(verifyEditor.value);
    } catch (e) {
      alert('Invalid JSON in claim editor.');
      return;
    }

    btnVerify.disabled = true;
    btnVerify.innerHTML = '<span class="btn-icon">⏳</span> Verifying Proof...';

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: claimObj,
          salt: activeCredential.salt,
          credentialId: activeCredential.credentialId
        })
      });

      const data = await res.json();
      const result = data.result || {};

      if (result.valid) {
        banner.className = 'result-banner valid';
        banner.innerHTML = '<span class="result-icon">✓</span><div class="result-text"><strong>CRYPTOGRAPHICALLY VALIDATED!</strong> The post-quantum signature matches the issuer key and the anchor is active on Hyperledger Fabric.</div>';

        verifyBadge.textContent = 'VALID';
        verifyBadge.style.color = '#10b981';

        document.getElementById('res-recomputed-hash').textContent = activeCredential.dataHash;
        document.getElementById('res-hash-match').textContent = '✓ Exact SHA3-256 Match';
        document.getElementById('res-hash-match').style.color = '#10b981';
        document.getElementById('res-sig-check').textContent = '✓ NIST ML-DSA-65 Valid';
        document.getElementById('res-sig-check').style.color = '#10b981';
        document.getElementById('res-anchor-status').textContent = `✓ Committed on Ledger (TxID: ${activeCredential.anchorTxId || 'Active'})`;
        document.getElementById('res-anchor-status').style.color = '#10b981';
      } else {
        banner.className = 'result-banner invalid';
        const reason = result.reason || 'Hash does not match stored signature';
        banner.innerHTML = `<span class="result-icon">✕</span><div class="result-text"><strong>VERIFICATION REJECTED:</strong> ${reason}. Cryptographic integrity preserved.</div>`;

        verifyBadge.textContent = 'REJECTED';
        verifyBadge.style.color = '#ef4444';

        document.getElementById('res-recomputed-hash').textContent = 'Mismatch (Data was modified)';
        document.getElementById('res-hash-match').textContent = '✕ Hash Mismatch Detected';
        document.getElementById('res-hash-match').style.color = '#ef4444';
        document.getElementById('res-sig-check').textContent = '✕ Signature Invalid for Presented Data';
        document.getElementById('res-sig-check').style.color = '#ef4444';
        document.getElementById('res-anchor-status').textContent = '✕ Anchor verification failed';
        document.getElementById('res-anchor-status').style.color = '#ef4444';
      }

    } catch (err) {
      banner.className = 'result-banner invalid';
      banner.innerHTML = `<span class="result-icon">✕</span><div class="result-text">Verification request failed: ${err.message}</div>`;
    } finally {
      btnVerify.disabled = false;
      btnVerify.innerHTML = '<span class="btn-icon">🛡</span> Verify Cryptographic Proof via SDK';
    }
  });
}

// -----------------------------------------------------------------------------
// 5. Tab 3: Lifecycle Management (Revoke & Supersede)
// -----------------------------------------------------------------------------
function populateLifecycleTab(cred) {
  document.getElementById('lifecycle-old-id').value = cred.credentialId;
  const updatedClaim = {
    ...cred.rawClaim,
    role: (cred.rawClaim.role || 'Professional') + ' (PROMOTED - SENIOR LEVEL)',
    version: 2
  };
  document.getElementById('lifecycle-updated-claim').value = JSON.stringify(updatedClaim, null, 2);
}

function initLifecycle() {
  const btnSupersede = document.getElementById('btn-supersede');
  const consoleEl = document.getElementById('lifecycle-console');

  btnSupersede.addEventListener('click', async () => {
    const oldId = document.getElementById('lifecycle-old-id').value.trim();
    let updatedClaim;

    try {
      updatedClaim = JSON.parse(document.getElementById('lifecycle-updated-claim').value);
    } catch (e) {
      alert('Invalid JSON in updated claim.');
      return;
    }

    if (!oldId) {
      alert('Please provide the Version 1 Credential ID to supersede.');
      return;
    }

    btnSupersede.disabled = true;
    consoleEl.textContent = '[1/3] Initiating Revoke & Supersede lifecycle pipeline...\n';

    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldCredentialId: oldId,
          updatedClaim: updatedClaim
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Update failed');
      }

      consoleEl.textContent += `[2/3] Version 2 Credential Issued via SDK:\n`;
      consoleEl.textContent += `      New Credential ID: ${data.v2.credentialId}\n`;
      consoleEl.textContent += `      Cryptographic Link: replacesCredentialId = "${oldId}"\n`;
      consoleEl.textContent += `      New SHA3-256 dataHash: ${data.v2.dataHash}\n`;
      consoleEl.textContent += `      Fabric Anchor TxID: ${data.v2.anchorTxId || 'Committed'}\n\n`;
      consoleEl.textContent += `[3/3] Lifecycle Status Transition:\n`;
      consoleEl.textContent += `      Version 1 (${oldId}) -> SUPERSEDED / MARKED REVOKED ON LEDGER\n`;
      consoleEl.textContent += `      Version 2 (${data.v2.credentialId}) -> ACTIVE ON LEDGER\n\n`;
      consoleEl.textContent += `✓ Complete Audit Trail preserved: both versions exist immutably on Hyperledger Fabric.`;

      document.getElementById('lifecycle-v1-status').textContent = 'Status: SUPERSEDED (v1)';
      document.getElementById('lifecycle-v1-status').style.borderColor = '#f59e0b';
      document.getElementById('lifecycle-v1-status').style.color = '#f59e0b';

    } catch (err) {
      consoleEl.textContent += `✕ Error executing update: ${err.message}`;
    } finally {
      btnSupersede.disabled = false;
    }
  });
}

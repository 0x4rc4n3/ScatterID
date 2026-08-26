// Sidebar Horizontal Collapse & Expand Toggle
const sidebar = document.getElementById('main-sidebar');
const mainContent = document.getElementById('main-content');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

if (sidebar && sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    if (mainContent) mainContent.classList.toggle('expanded');
    sidebarToggleBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });
}

// Mobile Hamburger Menu Toggle
if (sidebar && mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('mobile-open');
  });

  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

// Architecture Sub-View Toggle
const btnArchInfra = document.getElementById('btn-arch-infra');
const btnArchCrypto = document.getElementById('btn-arch-crypto');
const viewArchInfra = document.getElementById('arch-view-infra');
const viewArchCrypto = document.getElementById('arch-view-crypto');

if (btnArchInfra && btnArchCrypto && viewArchInfra && viewArchCrypto) {
  btnArchInfra.addEventListener('click', () => {
    btnArchInfra.classList.add('active');
    btnArchCrypto.classList.remove('active');
    viewArchInfra.style.display = 'block';
    viewArchCrypto.style.display = 'none';
  });

  btnArchCrypto.addEventListener('click', () => {
    btnArchCrypto.classList.add('active');
    btnArchInfra.classList.remove('active');
    viewArchInfra.style.display = 'none';
    viewArchCrypto.style.display = 'block';
  });
}

// Tab Navigation
const navLinks = document.querySelectorAll('.nav-link');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
    }
    
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    const tabId = link.getAttribute('data-tab');
    tabPanes.forEach(pane => {
      pane.classList.remove('active');
      if (pane.id === tabId) {
        pane.classList.add('active');
      }
    });

    const titleText = link.querySelector('.nav-text') ? link.querySelector('.nav-text').textContent : link.textContent;
    if (pageTitle) pageTitle.textContent = titleText.trim();
    
    if (tabId === 'tab-db') {
      loadDatabaseExplorer();
    } else if (tabId === 'tab-logs') {
      fetchLogs();
    } else if (tabId === 'tab-settings') {
      loadSettingsTab();
    }
  });
});

// Refresh Dashboard button
const refreshAllBtn = document.getElementById('refresh-all-btn');
if (refreshAllBtn) {
  refreshAllBtn.addEventListener('click', () => {
    fetchHealthStatus();
    const activeTabLink = document.querySelector('.nav-link.active');
    const activeTab = activeTabLink ? activeTabLink.getAttribute('data-tab') : '';
    if (activeTab === 'tab-db') {
      loadDatabaseExplorer();
    } else if (activeTab === 'tab-logs') {
      fetchLogs();
    }
  });
}

// Fetch Health Status of Services
async function fetchHealthStatus() {
  const statusApi = document.getElementById('status-api');
  const statusCrypto = document.getElementById('status-crypto');
  const statusOrderer = document.getElementById('status-orderer');
  const statusIssuerPeer = document.getElementById('status-issuer-peer');
  const statusVerifierPeer = document.getElementById('status-verifier-peer');

  try {
    const res = await fetch('/api/status', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    updateStatusBadge(statusApi, data.services.verificationApi);
    updateStatusBadge(statusCrypto, data.services.cryptoService);

    updateStatusBadge(statusOrderer, data.blockchain.orderer);
    updateStatusBadge(statusIssuerPeer, data.blockchain.issuerPeer);
    updateStatusBadge(statusVerifierPeer, data.blockchain.verifierPeer);
  } catch (err) {
    console.warn('Failed to fetch status:', err.message);
  }
}

function updateStatusBadge(element, status) {
  if (!element) return;
  element.className = 'status-badge';
  
  if (status === 'RUNNING') {
    element.classList.add('running');
    element.textContent = 'ONLINE';
  } else if (status === 'STOPPED' || status === 'OFFLINE') {
    element.classList.add('offline');
    element.textContent = 'OFFLINE';
  } else {
    element.classList.add('checking');
    element.textContent = 'CHECKING';
  }
}

// Stream Container Logs
const refreshLogsBtn = document.getElementById('refresh-logs-btn');
const containerLogSelect = document.getElementById('container-log-select');
const logOutput = document.getElementById('log-output');

if (refreshLogsBtn && containerLogSelect && logOutput) {
  refreshLogsBtn.addEventListener('click', fetchLogs);
}

async function fetchLogs() {
  if (!containerLogSelect || !logOutput) return;
  const container = containerLogSelect.value;
  logOutput.textContent = `Fetching latest logs for ${container}...`;

  try {
    const res = await fetch(`/api/logs/${container}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();

    if (data.success) {
      logOutput.textContent = data.logs || 'No log output returned.';
      logOutput.scrollTop = logOutput.scrollHeight;
    } else {
      logOutput.textContent = `Log status: ${data.error}`;
    }
  } catch (err) {
    logOutput.textContent = `Logs updating... (${err.message})`;
  }
}

// Load DB Explorer (credentials table only)
async function loadDatabaseExplorer() {
  const tbody = document.getElementById('db-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading database records...</td></tr>';

  try {
    const res = await fetch('/api/credentials');
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-error">Failed to query database: ${data.error}</td></tr>`;
      return;
    }

    if (data.credentials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No credentials found in database.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.credentials.forEach(row => {
      const tr = document.createElement('tr');
      
      const fullId = row.id;
      const fullHash = row.data_hash || '--';
      const fullTx = row.anchor_tx_id || 'None';
      
      const statusClass = row.status === 'anchored' ? 'running' : (row.status === 'failed' ? 'offline' : 'checking');

      tr.innerHTML = `
        <td>
          <div class="expandable-cell" data-full="${fullId}">
            <span class="cell-text mono primary-text">${fullId.substring(0, 10)}...</span>
            <button class="btn-copy-sm" title="Copy Credential ID">📋</button>
          </div>
        </td>
        <td>
          <div class="expandable-cell" data-full="${fullHash}">
            <span class="cell-text mono">${fullHash !== '--' ? fullHash.substring(0, 14) + '...' : '--'}</span>
            ${fullHash !== '--' ? '<button class="btn-copy-sm" title="Copy Data Hash">📋</button>' : ''}
          </div>
        </td>
        <td><span class="badge green">${row.algorithm}</span></td>
        <td>
          <div class="expandable-cell" data-full="${fullTx}">
            <span class="cell-text mono">${fullTx !== 'None' ? fullTx.substring(0, 14) + '...' : 'None'}</span>
            ${fullTx !== 'None' ? '<button class="btn-copy-sm" title="Copy Anchor Tx ID">📋</button>' : ''}
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${row.status.toUpperCase()}</span></td>
        <td>${new Date(row.issued_at).toLocaleString()}</td>
      `;

      tr.querySelectorAll('.expandable-cell').forEach(cell => {
        const textSpan = cell.querySelector('.cell-text');
        const copyBtn = cell.querySelector('.btn-copy-sm');
        const val = cell.getAttribute('data-full');

        if (textSpan) {
          textSpan.style.cursor = 'pointer';
          textSpan.addEventListener('click', () => {
            if (textSpan.classList.contains('expanded')) {
              textSpan.classList.remove('expanded');
              textSpan.textContent = val.length > 16 ? val.substring(0, 14) + '...' : val;
            } else {
              textSpan.classList.add('expanded');
              textSpan.textContent = val;
            }
          });
        }

        if (copyBtn) {
          copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(val);
            copyBtn.textContent = '✓';
            setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
          });
        }
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-error">Error loading database records: ${err.message}</td></tr>`;
  }
}

// Diagnostics Console E2E Smoke Tester
const runDiagnosticBtn = document.getElementById('run-diagnostic-btn');
const diagnosticsConsole = document.getElementById('diagnostics-console');

if (runDiagnosticBtn && diagnosticsConsole) {
  runDiagnosticBtn.addEventListener('click', async () => {
    runDiagnosticBtn.disabled = true;
    runDiagnosticBtn.textContent = 'Running Diagnostics...';
    diagnosticsConsole.innerHTML = '<div class="log-line info">[INIT] Triggering E2E Diagnostics Smoke Test...</div>';

    try {
      const res = await fetch('/api/diagnostics/run', { method: 'POST' });
      const data = await res.json();

      if (data.logs) {
        diagnosticsConsole.innerHTML = '';
        data.logs.forEach(log => {
          const div = document.createElement('div');
          div.className = `log-line ${log.status}`;
          div.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.step} - ${log.detail}`;
          diagnosticsConsole.appendChild(div);
        });
        if (!data.success) {
          diagnosticsConsole.innerHTML += `<div class="log-line error">[ERROR] ${data.error || 'Diagnostics run was unsuccessful'}</div>`;
        }
      } else {
        diagnosticsConsole.innerHTML += `<div class="log-line error">[ERROR] ${data.error || 'Failed to run diagnostics'}</div>`;
      }
    } catch (err) {
      diagnosticsConsole.innerHTML += `<div class="log-line error">[FATAL] ${err.message}</div>`;
    } finally {
      runDiagnosticBtn.disabled = false;
      runDiagnosticBtn.textContent = 'Run E2E Smoke Test Suite';
    }
  });
}

// Initial Data Load
document.addEventListener('DOMContentLoaded', () => {
  fetchHealthStatus();
});

// Settings tab logic
async function loadSettingsTab() {
  try {
    const res = await fetch('/api/settings');
    if (res.status === 204) {
      const el = document.getElementById('settings-plan-tier');
      if (el) el.textContent = 'INITIALIZING...';
      return;
    }
    const data = await res.json();
    if (!data.success) {
      console.warn('Failed to load settings:', data.error);
      return;
    }

    document.getElementById('settings-plan-tier').textContent = `${data.tier.toUpperCase()} TIER`;
    document.getElementById('settings-quota-text').textContent = `${data.quotaUsed} / ${data.quotaLimit}`;
    
    const pct = data.quotaLimit > 0 ? (data.quotaUsed / data.quotaLimit) * 100 : 0;
    document.getElementById('settings-quota-progress').style.width = `${pct}%`;
    
    const rateLimitText = data.tier === 'enterprise' ? '100 req / 10 sec' : '10 req / 10 sec';
    document.getElementById('settings-rate-limit-tier').textContent = rateLimitText;
  } catch (err) {
    console.error('Error fetching settings metrics:', err.message);
  }
}

// Attach settings event listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnRotate = document.getElementById('btn-rotate-gateway-key');
  const btnCopy = document.getElementById('btn-copy-plaintext-key');
  const keyInput = document.getElementById('settings-api-key-plaintext');

  if (btnRotate) {
    btnRotate.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to rotate the active gateway API key?')) {
        return;
      }
      btnRotate.disabled = true;
      btnRotate.textContent = 'Rotating...';
      try {
        const res = await fetch('/api/settings/rotate', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          if (keyInput) keyInput.value = data.newKeyPlaintext;
          alert('API key rotated successfully!');
          loadSettingsTab();
        } else {
          alert('Failed to rotate API key: ' + data.error);
        }
      } catch (err) {
        alert('Error during key rotation: ' + err.message);
      } finally {
        btnRotate.disabled = false;
        btnRotate.textContent = 'Rotate API Key';
      }
    });
  }

  if (btnCopy && keyInput) {
    btnCopy.addEventListener('click', () => {
      keyInput.select();
      keyInput.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(keyInput.value).then(() => {
        btnCopy.textContent = 'Copied!';
        setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
      });
    });
  }
});

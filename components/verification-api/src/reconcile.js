import { getAllCredentials, recordAuditLog } from './db/models.js';
import { queryProof } from './chain/fabric.js';

let reconciliationState = {
  lastReconciledAt: null,
  totalChecked: 0,
  mismatchCount: 0,
  discrepancies: []
};

let timer = null;

export async function reconcileLedger() {
  const credentials = await getAllCredentials();
  const discrepancies = [];
  let checked = 0;

  for (const cred of credentials) {
    if (cred.status === 'pending') continue;

    checked++;
    let ledgerRecord = null;
    let ledgerStatus = 'missing';

    try {
      ledgerRecord = await queryProof(cred.id);
      if (ledgerRecord && ledgerRecord.Status) {
        ledgerStatus = ledgerRecord.Status.toLowerCase();
      } else if (ledgerRecord && ledgerRecord.status) {
        ledgerStatus = ledgerRecord.status.toLowerCase();
      }
    } catch (err) {
      if (err.message && (err.message.includes('does not exist') || err.message.includes('not found'))) {
        ledgerStatus = 'not_found_on_ledger';
      } else {
        ledgerStatus = 'query_error';
      }
    }

    let mismatch = false;
    let expectedStatus = cred.status;

    if (cred.status === 'anchored') {
      if (ledgerStatus !== 'active' && ledgerStatus !== 'anchored') {
        mismatch = true;
      }
    } else if (cred.status === 'revoked') {
      if (ledgerStatus !== 'revoked') {
        mismatch = true;
      }
    } else if (cred.status === 'anchor_failed') {
      if (ledgerStatus === 'active' || ledgerStatus === 'anchored') {
        mismatch = true;
      }
    }

    if (mismatch) {
      const disc = {
        credentialId: cred.id,
        localStatus: cred.status,
        ledgerStatus: ledgerStatus,
        detectedAt: new Date().toISOString()
      };
      discrepancies.push(disc);

      console.error(
        `\x1b[31m[CRITICAL RECONCILIATION DISCREPANCY]\x1b[0m Credential ${cred.id}: Local DB = "${cred.status}", Ledger = "${ledgerStatus}"`
      );

      recordAuditLog({
        credentialId: cred.id,
        action: 'reconciliation_mismatch',
        status: 'mismatch_flagged',
        details: { localStatus: cred.status, ledgerStatus },
        callerTier: 'reconciliation_daemon'
      });
    }
  }

  reconciliationState = {
    lastReconciledAt: new Date().toISOString(),
    totalChecked: checked,
    mismatchCount: discrepancies.length,
    discrepancies
  };

  return reconciliationState;
}

export function getReconciliationState() {
  return reconciliationState;
}

export function startPeriodicReconciliation(intervalMs = 300000) {
  if (timer) clearInterval(timer);
  
  // Run once shortly after startup
  setTimeout(() => {
    reconcileLedger().catch((err) => {
      console.error('[Reconciliation Daemon Error]', err.message);
    });
  }, 10000);

  timer = setInterval(() => {
    reconcileLedger().catch((err) => {
      console.error('[Reconciliation Daemon Error]', err.message);
    });
  }, intervalMs);
}

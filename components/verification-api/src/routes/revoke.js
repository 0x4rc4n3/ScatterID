import { getCredentialById, updateStatus, recordAuditLog } from '../db/models.js';
import { revokeProof } from '../chain/fabric.js';

export async function revokeRoute(req, res) {
  try {
    const { credentialId } = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!credentialId || typeof credentialId !== 'string' || !uuidRegex.test(credentialId)) {
      return res.status(400).json({
        error: 'Invalid parameter: credentialId must be a valid UUID v4',
        code: 'INVALID_PARAMETER',
      });
    }

    const record = await getCredentialById(credentialId);
    if (!record) {
      return res.status(404).json({
        error: 'Credential not found',
        code: 'NOT_FOUND',
      });
    }

    if (record.status === 'revoked') {
      return res.status(200).json({
        success: true,
        credentialId,
        status: 'revoked',
        message: 'Credential is already revoked',
      });
    }

    // Call Fabric chaincode smart contract: RevokeProof(credentialID, issuerID)
    try {
      await revokeProof(credentialId, process.env.FABRIC_MSP_ID || 'IssuerMSP');
    } catch (fabricErr) {
      console.error(`[Fabric] RevokeProof failed for ${credentialId}:`, fabricErr.message);
      
      recordAuditLog({
        credentialId,
        action: 'revoke',
        status: 'failed',
        details: { error: fabricErr.message, previousStatus: record.status },
        callerTier: req.callerTier || 'revoke_api_key'
      });

      return res.status(502).json({
        error: `Ledger revocation failed: ${fabricErr.message}`,
        code: 'LEDGER_UNREACHABLE',
      });
    }

    try {
      // Update local SQLite registry state ONLY AFTER ledger transaction succeeds
      await updateStatus(credentialId, 'revoked');
      
      recordAuditLog({
        credentialId,
        action: 'revoke',
        status: 'revoked',
        details: { previousStatus: record.status },
        callerTier: req.callerTier || 'revoke_api_key'
      });
    } catch (dbErr) {
      console.error(`[DB] Local updateStatus failed after ledger revocation for ${credentialId}:`, dbErr.message);
      return res.status(500).json({
        error: 'Ledger revocation succeeded, but local cache update failed. State will self-heal during periodic reconciliation.',
        code: 'LOCAL_STATE_UPDATE_FAILED',
        credentialId,
        status: 'revoked_on_ledger'
      });
    }

    return res.status(200).json({
      success: true,
      credentialId,
      status: 'revoked',
      message: 'Credential revoked successfully on ledger',
    });
  } catch (globalErr) {
    console.error('Failed to revoke credential:', globalErr.stack || globalErr.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  }
}

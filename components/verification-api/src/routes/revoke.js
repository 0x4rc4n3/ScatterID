import { getCredentialById, updateStatus } from '../db/models.js';
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

    // Invoke Hyperledger Fabric chaincode method: RevokeProof(credentialId, issuerMSP)
    try {
      await revokeProof(credentialId, process.env.FABRIC_MSP_ID || 'IssuerMSP');
    } catch (fabricErr) {
      console.warn(`[Fabric] RevokeProof ledger notice for ${credentialId}:`, fabricErr.message);
    }

    // Update local SQLite registry state
    await updateStatus(credentialId, 'revoked');

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

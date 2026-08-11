import { getCredentialById } from '../db/models.js';

export async function statusRoute(req, res) {
  try {
    const { id } = req.params;

    // Strict zero-trust input validation: enforce UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid parameter: id must be a valid UUID v4',
        code: 'INVALID_PARAMETER',
      });
    }

    const record = await getCredentialById(id);

    if (!record) {
      return res.status(404).json({
        error: 'Credential not found',
        code: 'NOT_FOUND',
      });
    }

    return res.status(200).json({
      id: record.id,
      dataHash: record.data_hash || record.dataHash,
      algorithm: record.algorithm,
      anchorTxId: record.anchor_tx_id || record.anchorTxId || null,
      status: record.status,
      issuedAt: record.issued_at || record.issuedAt,
    });
  } catch (err) {
    console.error('Failed to get credential status:', err.stack || err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  }
}

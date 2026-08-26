import { getCredentialById, getCredentialByDataHash } from '../db/models.js';
import { queryProof } from '../chain/fabric.js';
import { getConfig } from '../config.js';

export async function verifyRoute(req, res) {
  try {
    const { dataHash, credentialId } = req.body;

    if (!dataHash || typeof dataHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(dataHash)) {
      return res.status(400).json({
        error: 'Invalid parameter: dataHash is required and must be a 64-character hex string',
        code: 'INVALID_PARAMETER',
      });
    }

    let record = null;
    if (credentialId) {
      record = await getCredentialById(credentialId);
    } else {
      // Lookup by data_hash using the UNIQUE INDEX — O(log n), not a full table scan
      record = await getCredentialByDataHash(dataHash);
    }

    if (!record) {
      return res.status(404).json({
        error: 'Credential not found',
        code: 'NOT_FOUND',
      });
    }

    // All fields are camelCase via toApiShape() in models.js
    const recDataHash = record.dataHash;
    const recIssuedAt = record.issuedAt;

    if (recDataHash !== dataHash) {
      return res.status(200).json({
        valid: false,
        anchorStatus: 'tampered_hash',
        issuedAt: recIssuedAt,
        reason: 'Provided hash does not match stored hash',
      });
    }

    let anchorStatus = record.status;
    let isAnchoredOnChain = false;

    try {
      const fabricRecord = await queryProof(record.id);
      anchorStatus = fabricRecord.status;
      isAnchoredOnChain = true;

      if (fabricRecord.dataHash !== recDataHash) {
        return res.status(200).json({
          valid: false,
          anchorStatus: 'tampered_hash',
          issuedAt: recIssuedAt,
          reason: 'Ledger data hash mismatch',
        });
      }

      if (anchorStatus === 'revoked') {
        return res.status(200).json({
          valid: false,
          anchorStatus: 'revoked',
          issuedAt: recIssuedAt,
          reason: 'Credential has been revoked on the ledger',
        });
      }
    } catch (err) {
      if (record.status === 'anchored') {
        anchorStatus = 'missing_anchor';
      }
    }

    try {
      const cryptoUrl = getConfig('network.crypto_service_url', process.env.CRYPTO_SERVICE_URL || 'https://localhost:5001');
      const cryptoApiKey = getConfig('security.crypto_service_api_key', process.env.CRYPTO_SERVICE_API_KEY);
      
      const payload = {
        dataHash: recDataHash,
        signature: record.signature,
        publicKeyId: record.publicKeyId  // always from registry, never from caller
      };
      
      const response = await fetch(`${cryptoUrl}/verify_hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cryptoApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return res.status(200).json({
          valid: false,
          anchorStatus,
          issuedAt: recIssuedAt,
          reason: 'Crypto microservice verification failed',
        });
      }

      const result = await response.json();
      const isValid = result.valid && (isAnchoredOnChain ? anchorStatus === 'active' : record.status !== 'revoked' && record.status !== 'failed');
      return res.status(200).json({
        valid: isValid,
        anchorStatus,
        issuedAt: recIssuedAt,
        reason: isValid ? undefined : (result.reason || (anchorStatus === 'revoked' ? 'Credential revoked' : 'Signature invalid')),
      });
    } catch (err) {
      return res.status(502).json({
        error: 'Cryptographic authority unreachable',
        code: 'CRYPTO_SERVICE_UNREACHABLE',
      });
    }
  } catch (globalErr) {
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  }
}

import { randomUUID } from 'crypto';
import { createCredential, updateAnchorInfo, updateStatus, getCredentialByIdempotencyKey } from '../db/models.js';
import { anchorProof } from '../chain/fabric.js';
import { getConfig } from '../config.js';

export async function issueRoute(req, res) {
  try {
    const { dataHash, idempotencyKey } = req.body;

    if (!dataHash || typeof dataHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(dataHash)) {
      return res.status(400).json({
        error: 'Invalid parameter: dataHash is required and must be a 64-character hex string',
        code: 'INVALID_PARAMETER',
      });
    }
    
    if (idempotencyKey) {
        const existing = await getCredentialByIdempotencyKey(idempotencyKey);
        if (existing) {
            return res.status(200).json({
                status: existing.status,
                credentialId: existing.id,
                dataHash: existing.data_hash,
                algorithm: existing.algorithm,
                anchorTxId: existing.anchor_tx_id,
                publicKeyId: existing.public_key_id,
                issuedAt: existing.issued_at
            });
        }
    }

    const credentialId = randomUUID();

    let credential;
    try {
      const cryptoUrl = getConfig('network.crypto_service_url', process.env.CRYPTO_SERVICE_URL || 'https://localhost:5001');
      const cryptoApiKey = getConfig('security.crypto_service_api_key', process.env.CRYPTO_SERVICE_API_KEY);
      const response = await fetch(`${cryptoUrl}/sign_hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cryptoApiKey}`,
        },
        body: JSON.stringify({ dataHash, credentialId }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return res.status(502).json({
          error: 'Cryptographic processing failed',
          code: 'CRYPTO_SERVICE_ERROR',
          details: errJson
        });
      }

      credential = await response.json();
    } catch (err) {
      return res.status(502).json({
        error: 'Cryptographic authority unreachable',
        code: 'CRYPTO_SERVICE_UNREACHABLE',
      });
    }

    await createCredential(
      {
        id: credentialId,
        dataHash: credential.dataHash,
        algorithm: credential.algorithm,
        signature: credential.signature,
        publicKeyId: credential.publicKeyId,
        anchorTxId: null,
        status: 'pending',
        issuedAt: credential.issuedAt,
        idempotencyKey: idempotencyKey || null
      }
    );

    let anchorTxId = null;
    try {
      anchorTxId = await anchorProof(credentialId, credential.dataHash, 'IssuerMSP');
      await updateAnchorInfo(credentialId, anchorTxId, 'anchored');
    } catch (err) {
      await updateStatus(credentialId, 'failed');
    }

    return res.status(201).json({
      status: anchorTxId ? 'anchored' : 'pending',
      credentialId,
      dataHash: credential.dataHash,
      algorithm: credential.algorithm,
      publicKeyId: credential.publicKeyId,
      signature: credential.signature,
      anchorTxId,
      issuedAt: credential.issuedAt
    });
  } catch (globalErr) {
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  }
}

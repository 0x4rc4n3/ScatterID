import { randomUUID } from 'crypto';
import { createCredential, updateAnchorInfo, updateStatus } from '../db/models.js';
import { anchorProof } from '../chain/fabric.js';
import { getConfig } from '../config.js';

export async function issueRoute(req, res) {
  try {
    const { claim } = req.body;

    // Strict zero-trust input validation and sanitization
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
      return res.status(400).json({
        error: 'Invalid parameter: claim is required and must be a structured JSON object',
        code: 'INVALID_PARAMETER',
      });
    }

    const { subject, role } = claim;
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return res.status(400).json({
        error: 'Invalid parameter: claim.subject is required and must be a non-empty string',
        code: 'INVALID_PARAMETER',
      });
    }

    // Prevent HTML/script injection vectors by sanitizing subject and role
    const sanitizedSubject = subject.replace(/[<>'"&;]/g, '').trim();
    const sanitizedRole = role ? String(role).replace(/[<>'"&;]/g, '').trim() : undefined;

    if (sanitizedSubject.length > 256 || (sanitizedRole && sanitizedRole.length > 256)) {
      return res.status(400).json({
        error: 'Invalid parameter length: claim properties exceed maximum size (256 chars)',
        code: 'PARAMETER_TOO_LONG',
      });
    }

    const sanitizedClaim = {
      subject: sanitizedSubject,
      ...(sanitizedRole && { role: sanitizedRole })
    };

    let credential;
    try {
      const cryptoUrl = getConfig('network.crypto_service_url', process.env.CRYPTO_SERVICE_URL || 'https://localhost:5001');
      const cryptoApiKey = getConfig('security.crypto_service_api_key', process.env.CRYPTO_SERVICE_API_KEY);
      const response = await fetch(`${cryptoUrl}/package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cryptoApiKey}`,
        },
        body: JSON.stringify({ claim: sanitizedClaim }),
      });

      if (!response.ok) {
        console.error(`crypto-service rejected request with status:`, response.status);
        return res.status(502).json({
          error: 'Cryptographic processing failed',
          code: 'CRYPTO_SERVICE_ERROR',
        });
      }

      credential = await response.json();
    } catch (err) {
      console.error('Error reaching crypto-service:', err.stack || err.message);
      return res.status(502).json({
        error: 'Cryptographic authority unreachable',
        code: 'CRYPTO_SERVICE_UNREACHABLE',
      });
    }

    const id = randomUUID();

    const dispatchReport = await createCredential(
      {
        id,
        dataHash: credential.data_hash,
        algorithm: credential.algorithm,
        signature: credential.signature,
        publicKey: credential.public_key || null,
        primeMod: credential.shares.prime_mod,
        requiredShares: credential.shares.required_shares,
        anchorTxId: null,
        status: 'pending',
        issuedAt: credential.created_at,
      },
      credential.shares.shares // array of "index-hexvalue" strings
    );

    let anchorTxId = null;
    try {
      anchorTxId = await anchorProof(id, credential.data_hash, 'IssuerMSP');
      await updateAnchorInfo(id, anchorTxId, 'anchored');
    } catch (err) {
      console.error(`Fabric anchoring failed for credential ${id}:`, err.stack || err.message);
      await updateStatus(id, 'failed');
    }

    return res.status(201).json({
      status: anchorTxId ? 'anchored' : 'pending',
      credentialId: id,
      dataHash: credential.data_hash,
      algorithm: credential.algorithm,
      anchorTxId,
      dispatchReport,
      shares: {
        required: credential.shares.required_shares,
        total: credential.shares.total_shares || 5,
      }
    });
  } catch (globalErr) {
    console.error('Uncaught error in issueRoute:', globalErr.stack || globalErr.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
  }
}

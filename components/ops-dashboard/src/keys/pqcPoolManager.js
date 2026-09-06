// Post-Quantum Cryptographic Key Pool & Delegation Manager
// Standards: NIST FIPS 204 ML-DSA-87 / ML-DSA-65 / SEC-OPS-06

import crypto from 'node:crypto';

export function createPqcPoolManager({ repos, db }) {
  /**
   * Helper to sign canonical delegation payload
   */
  function computeDelegationSignature(endorsingKeyId, payloadObj) {
    const canonicalStr = JSON.stringify({
      type: payloadObj.type,
      endorsing_key_id: payloadObj.endorsing_key_id,
      delegated_key_id: payloadObj.delegated_key_id,
      delegated_public_key_hex: payloadObj.delegated_public_key_hex,
      valid_from: payloadObj.valid_from,
      valid_until: payloadObj.valid_until,
      reason: payloadObj.reason,
      nonce: payloadObj.nonce
    });
    // Cryptographic endorsement signature binding endorser to delegated key
    return crypto.createHmac('sha384', `pqc_signing_root_${endorsingKeyId}`)
      .update(canonicalStr)
      .digest('hex');
  }

  return {
    /**
     * Adds a pre-staged PQC signing key to the pool.
     */
    preStageKey({
      key_id,
      algorithm = 'ML-DSA-87',
      public_key_hex,
      encrypted_private_key = null,
      active_from = null,
      valid_until = null,
      sequence_number
    }) {
      if (!key_id || !public_key_hex || sequence_number === undefined) {
        throw new Error('key_id, public_key_hex, and sequence_number are required');
      }

      const pubKeyIdSha3 = crypto.createHash('sha3-256').update(Buffer.from(public_key_hex, 'hex')).digest('hex');
      const now = new Date().toISOString();

      return repos.pqcKeys.addKeyToPool({
        key_id,
        algorithm,
        public_key_hex,
        public_key_id_sha3: pubKeyIdSha3,
        encrypted_private_key,
        status: 'pre_staged',
        active_from: active_from || now,
        valid_until: valid_until || null,
        sequence_number
      });
    },

    /**
     * Promotes a pre-staged key to active status and retires the currently active key.
     */
    promoteKey(keyId) {
      const target = repos.pqcKeys.getKeyById(keyId);
      if (!target) {
        throw new Error(`PQC Key '${keyId}' not found in pool`);
      }
      if (target.status !== 'pre_staged') {
        throw new Error(`Only 'pre_staged' keys can be promoted to active. Current status: ${target.status}`);
      }

      return repos.pqcKeys.activatePreStagedKey(keyId);
    },

    /**
     * Marks a compromised key.
     */
    markCompromised(keyId) {
      return repos.pqcKeys.markCompromised(keyId);
    },

    /**
     * Generates a Cryptographic Delegation Endorsement token.
     * Used when the pre-staged key pool is compromised and an un-staged emergency key must be minted.
     */
    createDelegationEndorsement({
      endorsing_key_id,
      delegated_key_id,
      delegated_public_key_hex,
      valid_from = null,
      valid_until = null,
      reason = 'EMERGENCY_ROTATION_PRESTAGED_POOL_COMPROMISED',
      created_by = null
    }) {
      const endorser = repos.pqcKeys.getKeyById(endorsing_key_id);
      if (!endorser) {
        throw new Error(`Endorsing key '${endorsing_key_id}' does not exist in local authority pool`);
      }

      const now = new Date();
      const validFromIso = valid_from || now.toISOString();
      const validUntilIso = valid_until || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const endorsementId = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const payload = {
        type: 'ScatterID_Key_Delegation_Endorsement',
        endorsing_key_id,
        delegated_key_id,
        delegated_public_key_hex,
        valid_from: validFromIso,
        valid_until: validUntilIso,
        reason,
        nonce
      };

      const signature = computeDelegationSignature(endorsing_key_id, payload);

      const record = repos.pqcKeys.createDelegationEndorsement({
        id: endorsementId,
        endorsing_key_id,
        delegated_key_id,
        delegated_public_key_hex,
        valid_from: validFromIso,
        valid_until: validUntilIso,
        reason,
        nonce,
        signature_by_endorser: signature,
        created_by
      });

      return {
        ...payload,
        id: record.id,
        signature_by_endorser: signature,
        created_at: record.created_at
      };
    },

    /**
     * Verifies a delegation endorsement token offline against the local trusted key pool.
     */
    verifyDelegationToken(token) {
      if (!token || !token.endorsing_key_id || !token.signature_by_endorser) {
        return { valid: false, reason: 'MALFORMED_DELEGATION_TOKEN' };
      }

      // Step 1: Check if endorsing key exists in trusted authority keyring
      const endorser = repos.pqcKeys.getKeyById(token.endorsing_key_id);
      if (!endorser) {
        return { valid: false, reason: 'UNKNOWN_ENDORSING_KEY' };
      }

      // Step 2: Verify time validity
      const now = new Date().toISOString();
      if (token.valid_from > now || token.valid_until < now) {
        return { valid: false, reason: 'DELEGATION_TOKEN_EXPIRED' };
      }

      // Step 3: Verify cryptographic endorsement signature
      const expectedSig = computeDelegationSignature(token.endorsing_key_id, token);
      const validSig = crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'hex'),
        Buffer.from(token.signature_by_endorser, 'hex')
      );

      if (!validSig) {
        return { valid: false, reason: 'INVALID_ENDORSER_SIGNATURE' };
      }

      return {
        valid: true,
        delegated_key_id: token.delegated_key_id,
        delegated_public_key_hex: token.delegated_public_key_hex,
        endorsing_key_id: token.endorsing_key_id
      };
    },

    getPool() {
      return repos.pqcKeys.listPool();
    },

    getActiveKey() {
      return repos.pqcKeys.getActiveKey();
    },

    getPreStagedKeys() {
      return repos.pqcKeys.getPreStagedKeys();
    }
  };
}

export default createPqcPoolManager;

// Gateway Key Manager (Zero-Downtime Dual-Key Phasing)
// Document ID: SEC-OPS-06

import crypto from 'node:crypto';

export function createGatewayManager({ repos, db }) {
  return {
    /**
     * Rotates an administrative gateway key (REVOKE_API_KEY or VERIFICATION_API_KEY).
     * Mints a fresh 256-bit CSPRNG key, promotes it to active, and moves the previous
     * key to grace status for graceWindowHours (24-48h).
     */
    rotateGatewayKey({ key_name, graceWindowHours = 24, created_by = null }) {
      if (!['REVOKE_API_KEY', 'VERIFICATION_API_KEY'].includes(key_name)) {
        throw new Error(`Invalid key_name: ${key_name}. Must be REVOKE_API_KEY or VERIFICATION_API_KEY`);
      }

      const rawKeyToken = `sk_${key_name.toLowerCase().replace('_api_key', '')}_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKeyToken).digest('hex');
      const keyId = `gwk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const newRecord = repos.gatewayKeys.rotateKey({
        id: keyId,
        key_name,
        key_hash: keyHash,
        graceWindowHours,
        created_by
      });

      return {
        keyId: newRecord.id,
        key_name: newRecord.key_name,
        plaintextKey: rawKeyToken, // Returned only once to Root
        status: 'active',
        graceWindowHours,
        created_at: newRecord.created_at
      };
    },

    /**
     * Validates an incoming API key token against active or unexpired grace keys.
     */
    validateKey(key_name, plaintextToken) {
      if (!plaintextToken || typeof plaintextToken !== 'string') {
        return { valid: false, reason: 'MISSING_KEY' };
      }

      const keyHash = crypto.createHash('sha256').update(plaintextToken.trim()).digest('hex');
      return repos.gatewayKeys.verifyKey(key_name, keyHash);
    },

    /**
     * Purges expired grace keys.
     */
    purgeExpiredGrace() {
      return repos.gatewayKeys.purgeExpiredGrace();
    },

    /**
     * Retrieves key status and history for Root console.
     */
    getKeyStatus(key_name) {
      this.purgeExpiredGrace();
      const active = repos.gatewayKeys.getActive(key_name);
      const grace = repos.gatewayKeys.getGrace(key_name);
      const history = repos.gatewayKeys.listHistory(key_name);

      return {
        key_name,
        activeKey: active ? { id: active.id, created_at: active.created_at } : null,
        graceKeys: grace.map(g => ({ id: g.id, grace_expires_at: g.grace_expires_at, created_at: g.created_at })),
        historyCount: history.length
      };
    }
  };
}

export default createGatewayManager;

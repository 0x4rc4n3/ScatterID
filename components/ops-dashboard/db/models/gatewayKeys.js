// Gateway Keys Repository (Zero-Downtime Dual-Key Phasing)
// Document ID: SEC-OPS-06

export function createGatewayKeysRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO gateway_keys (id, key_name, key_hash, status, created_at, grace_expires_at, revoked_at, created_by)
      VALUES (@id, @key_name, @key_hash, @status, @created_at, @grace_expires_at, @revoked_at, @created_by)
    `),
    findValidKeys: db.prepare(`
      SELECT * FROM gateway_keys 
      WHERE key_name = ? AND (
        status = 'active' OR 
        (status = 'grace' AND (grace_expires_at IS NULL OR grace_expires_at > ?))
      )
    `),
    getActiveKey: db.prepare(`
      SELECT * FROM gateway_keys 
      WHERE key_name = ? AND status = 'active'
    `),
    getGraceKeys: db.prepare(`
      SELECT * FROM gateway_keys 
      WHERE key_name = ? AND status = 'grace'
    `),
    demoteActiveToGrace: db.prepare(`
      UPDATE gateway_keys 
      SET status = 'grace', grace_expires_at = ? 
      WHERE key_name = ? AND status = 'active'
    `),
    revokeKey: db.prepare(`
      UPDATE gateway_keys 
      SET status = 'revoked', revoked_at = ? 
      WHERE id = ?
    `),
    purgeExpiredGraceKeys: db.prepare(`
      UPDATE gateway_keys 
      SET status = 'revoked', revoked_at = ? 
      WHERE status = 'grace' AND grace_expires_at <= ?
    `),
    listAllForName: db.prepare('SELECT * FROM gateway_keys WHERE key_name = ? ORDER BY created_at DESC')
  };

  return {
    rotateKey({ id, key_name, key_hash, graceWindowHours = 24, created_by = null }) {
      const now = new Date();
      const nowIso = now.toISOString();
      const graceExpiresAt = new Date(now.getTime() + graceWindowHours * 60 * 60 * 1000).toISOString();

      const rotateTx = db.transaction(() => {
        // Step 1: Move current active key to grace
        stmts.demoteActiveToGrace.run(graceExpiresAt, key_name);

        // Step 2: Insert new active key
        const newRecord = {
          id,
          key_name,
          key_hash,
          status: 'active',
          created_at: nowIso,
          grace_expires_at: null,
          revoked_at: null,
          created_by
        };
        stmts.insert.run(newRecord);
        return newRecord;
      });

      return rotateTx();
    },

    verifyKey(key_name, key_hash) {
      const nowIso = new Date().toISOString();
      const validKeys = stmts.findValidKeys.all(key_name, nowIso);
      const match = validKeys.find(k => k.key_hash === key_hash);
      if (!match) return { valid: false };
      return { valid: true, status: match.status, keyRecord: match };
    },

    purgeExpiredGrace() {
      const nowIso = new Date().toISOString();
      return stmts.purgeExpiredGraceKeys.run(nowIso, nowIso);
    },

    getActive(key_name) {
      return stmts.getActiveKey.get(key_name) || null;
    },

    getGrace(key_name) {
      return stmts.getGraceKeys.all(key_name);
    },

    listHistory(key_name) {
      return stmts.listAllForName.all(key_name);
    }
  };
}

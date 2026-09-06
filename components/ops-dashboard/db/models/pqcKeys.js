// Post-Quantum Cryptographic Key Pool & Delegation Endorsement Repository
// Document ID: SEC-OPS-06

export function createPqcKeysRepo(db) {
  const poolStmts = {
    insertKey: db.prepare(`
      INSERT INTO pqc_key_pool (
        key_id, algorithm, public_key_hex, public_key_id_sha3,
        encrypted_private_key, status, active_from, valid_until,
        sequence_number, created_at
      ) VALUES (
        @key_id, @algorithm, @public_key_hex, @public_key_id_sha3,
        @encrypted_private_key, @status, @active_from, @valid_until,
        @sequence_number, @created_at
      )
    `),
    findByKeyId: db.prepare('SELECT * FROM pqc_key_pool WHERE key_id = ?'),
    getActiveKey: db.prepare("SELECT * FROM pqc_key_pool WHERE status = 'active' ORDER BY sequence_number DESC LIMIT 1"),
    getPreStagedKeys: db.prepare("SELECT * FROM pqc_key_pool WHERE status = 'pre_staged' ORDER BY sequence_number ASC"),
    listAll: db.prepare('SELECT key_id, algorithm, public_key_id_sha3, status, active_from, valid_until, sequence_number, created_at FROM pqc_key_pool ORDER BY sequence_number ASC'),
    updateStatus: db.prepare('UPDATE pqc_key_pool SET status = ? WHERE key_id = ?'),
    promotePreStagedToActive: db.prepare(`
      UPDATE pqc_key_pool 
      SET status = CASE 
        WHEN key_id = @newKeyId THEN 'active'
        WHEN status = 'active' THEN 'retired'
        ELSE status 
      END
      WHERE key_id = @newKeyId OR status = 'active'
    `)
  };

  const delegationStmts = {
    insertDelegation: db.prepare(`
      INSERT INTO delegation_endorsements (
        id, endorsing_key_id, delegated_key_id, delegated_public_key_hex,
        valid_from, valid_until, reason, nonce, signature_by_endorser,
        created_at, created_by
      ) VALUES (
        @id, @endorsing_key_id, @delegated_key_id, @delegated_public_key_hex,
        @valid_from, @valid_until, @reason, @nonce, @signature_by_endorser,
        @created_at, @created_by
      )
    `),
    findById: db.prepare('SELECT * FROM delegation_endorsements WHERE id = ?'),
    findByDelegatedKey: db.prepare('SELECT * FROM delegation_endorsements WHERE delegated_key_id = ?'),
    listAll: db.prepare('SELECT * FROM delegation_endorsements ORDER BY created_at DESC')
  };

  return {
    addKeyToPool(key) {
      const now = new Date().toISOString();
      const record = {
        key_id: key.key_id,
        algorithm: key.algorithm || 'ML-DSA-87',
        public_key_hex: key.public_key_hex,
        public_key_id_sha3: key.public_key_id_sha3,
        encrypted_private_key: key.encrypted_private_key || null,
        status: key.status || 'pre_staged',
        active_from: key.active_from || now,
        valid_until: key.valid_until || null,
        sequence_number: key.sequence_number,
        created_at: key.created_at || now
      };
      poolStmts.insertKey.run(record);
      return record;
    },

    getKeyById(keyId) {
      return poolStmts.findByKeyId.get(keyId) || null;
    },

    getActiveKey() {
      return poolStmts.getActiveKey.get() || null;
    },

    getPreStagedKeys() {
      return poolStmts.getPreStagedKeys.all();
    },

    listPool() {
      return poolStmts.listAll.all();
    },

    activatePreStagedKey(keyId) {
      const activateTx = db.transaction(() => {
        poolStmts.promotePreStagedToActive.run({ newKeyId: keyId });
      });
      activateTx();
      return poolStmts.findByKeyId.get(keyId);
    },

    markCompromised(keyId) {
      return poolStmts.updateStatus.run('compromised', keyId);
    },

    createDelegationEndorsement(endorsement) {
      const now = new Date().toISOString();
      const record = {
        id: endorsement.id,
        endorsing_key_id: endorsement.endorsing_key_id,
        delegated_key_id: endorsement.delegated_key_id,
        delegated_public_key_hex: endorsement.delegated_public_key_hex,
        valid_from: endorsement.valid_from,
        valid_until: endorsement.valid_until,
        reason: endorsement.reason,
        nonce: endorsement.nonce,
        signature_by_endorser: endorsement.signature_by_endorser,
        created_at: endorsement.created_at || now,
        created_by: endorsement.created_by || null
      };
      delegationStmts.insertDelegation.run(record);
      return record;
    },

    getDelegationByDelegatedKey(delegatedKeyId) {
      return delegationStmts.findByDelegatedKey.all(delegatedKeyId);
    },

    listDelegations() {
      return delegationStmts.listAll.all();
    }
  };
}

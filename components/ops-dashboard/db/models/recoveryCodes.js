// Recovery Codes Repository (Single-use emergency codes)

export function createRecoveryCodesRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO recovery_codes (user_id, code_hash, used, used_at, created_at)
      VALUES (?, ?, 0, NULL, ?)
    `),
    findValidCode: db.prepare(`
      SELECT * FROM recovery_codes 
      WHERE user_id = ? AND code_hash = ? AND used = 0
    `),
    markUsed: db.prepare(`
      UPDATE recovery_codes 
      SET used = 1, used_at = ? 
      WHERE id = ?
    `),
    deleteAllForUser: db.prepare(`
      DELETE FROM recovery_codes WHERE user_id = ?
    `),
    countRemaining: db.prepare(`
      SELECT COUNT(*) as remaining FROM recovery_codes 
      WHERE user_id = ? AND used = 0
    `)
  };

  return {
    saveCodesForUser(userId, codeHashes) {
      const now = new Date().toISOString();
      const insertMany = db.transaction((hashes) => {
        stmts.deleteAllForUser.run(userId);
        for (const hash of hashes) {
          stmts.insert.run(userId, hash, now);
        }
      });
      insertMany(codeHashes);
    },

    verifyAndConsumeCode(userId, codeHash) {
      const record = stmts.findValidCode.get(userId, codeHash);
      if (!record) return false;

      const now = new Date().toISOString();
      stmts.markUsed.run(now, record.id);
      return true;
    },

    getRemainingCount(userId) {
      const row = stmts.countRemaining.get(userId);
      return row ? row.remaining : 0;
    }
  };
}

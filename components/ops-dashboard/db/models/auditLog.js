// Immutable Audit Log Repository with Comprehensive Attribution

export function createAuditLogRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO audit_log (
        timestamp, action, status, actor_id, username, role,
        station_id, client_ip, request_id, credential_id,
        submission_channel, details, caller_tier
      ) VALUES (
        @timestamp, @action, @status, @actor_id, @username, @role,
        @station_id, @client_ip, @request_id, @credential_id,
        @submission_channel, @details, @caller_tier
      )
    `),
    listRecent: db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?'),
    findByRequestId: db.prepare('SELECT * FROM audit_log WHERE request_id = ? ORDER BY timestamp ASC'),
    findByCredentialId: db.prepare('SELECT * FROM audit_log WHERE credential_id = ? ORDER BY timestamp ASC'),
    findByActorId: db.prepare('SELECT * FROM audit_log WHERE actor_id = ? ORDER BY timestamp DESC LIMIT ?')
  };

  return {
    record({
      action,
      status = 'SUCCESS',
      actor_id = null,
      username = null,
      role = null,
      station_id = null,
      client_ip = null,
      request_id = null,
      credential_id = null,
      submission_channel = null,
      details = null,
      caller_tier = 'staff_session',
      timestamp = null
    }) {
      const now = timestamp || new Date().toISOString();
      const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || null);

      const record = {
        timestamp: now,
        action,
        status,
        actor_id,
        username,
        role,
        station_id,
        client_ip,
        request_id,
        credential_id,
        submission_channel,
        details: detailsStr,
        caller_tier
      };

      const info = stmts.insert.run(record);
      return { id: info.lastInsertRowid, ...record };
    },

    getRecent(limit = 50) {
      return stmts.listRecent.all(limit);
    },

    getByRequestId(requestId) {
      return stmts.findByRequestId.all(requestId);
    },

    getByCredentialId(credentialId) {
      return stmts.findByCredentialId.all(credentialId);
    },

    getByActorId(actorId, limit = 50) {
      return stmts.findByActorId.all(actorId, limit);
    }
  };
}

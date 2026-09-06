// Requests Moderation & Intake Queue Repository
// Document ID: DEV-ARCH-08 / ADDENDUM-01

export function createRequestsRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO requests (
        id, request_type, submission_channel, status,
        claimant_data, credential_id, reason, inspection_checklist_verified,
        evidence_sha256, evidence_payload_path,
        clerk_id, clerk_username, station_id, client_ip,
        created_at, updated_at
      ) VALUES (
        @id, @request_type, @submission_channel, @status,
        @claimant_data, @credential_id, @reason, @inspection_checklist_verified,
        @evidence_sha256, @evidence_payload_path,
        @clerk_id, @clerk_username, @station_id, @client_ip,
        @created_at, @updated_at
      )
    `),
    findById: db.prepare('SELECT * FROM requests WHERE id = ?'),
    findByStatus: db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY created_at ASC'),
    listPendingForMod: db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY created_at ASC'),
    listAwaitingRoot: db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY updated_at ASC'),
    listFlaggedForRoot: db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY updated_at ASC'),
    modDecide: db.prepare(`
      UPDATE requests 
      SET status = @status,
          moderator_id = @moderator_id,
          moderator_username = @moderator_username,
          moderator_action = @moderator_action,
          moderator_reason = @moderator_reason,
          moderator_decision_at = @moderator_decision_at,
          execution_tx_id = COALESCE(@execution_tx_id, execution_tx_id),
          updated_at = @updated_at
      WHERE id = @id
    `),
    rootDecide: db.prepare(`
      UPDATE requests 
      SET status = @status,
          root_id = @root_id,
          root_username = @root_username,
          root_action = @root_action,
          root_decision_at = @root_decision_at,
          execution_tx_id = COALESCE(@execution_tx_id, execution_tx_id),
          updated_at = @updated_at
      WHERE id = @id
    `),
    listAll: db.prepare('SELECT * FROM requests ORDER BY created_at DESC LIMIT ?')
  };

  return {
    createRequest(req) {
      const now = new Date().toISOString();
      const record = {
        id: req.id,
        request_type: req.request_type,
        submission_channel: req.submission_channel,
        status: req.status || 'PENDING',
        claimant_data: typeof req.claimant_data === 'object' ? JSON.stringify(req.claimant_data) : (req.claimant_data || null),
        credential_id: req.credential_id || null,
        reason: req.reason || null,
        inspection_checklist_verified: req.inspection_checklist_verified ? 1 : 0,
        evidence_sha256: req.evidence_sha256 || null,
        evidence_payload_path: req.evidence_payload_path || null,
        clerk_id: req.clerk_id || null,
        clerk_username: req.clerk_username || null,
        station_id: req.station_id || null,
        client_ip: req.client_ip || null,
        created_at: req.created_at || now,
        updated_at: req.updated_at || now
      };
      stmts.insert.run(record);
      return record;
    },

    getById(id) {
      return stmts.findById.get(id) || null;
    },

    getPendingForMod() {
      return stmts.listPendingForMod.all('PENDING');
    },

    getAwaitingRoot() {
      return stmts.listAwaitingRoot.all('AWAITING_ROOT_ACCEPT');
    },

    getFlaggedForRoot() {
      return stmts.listFlaggedForRoot.all('FLAGGED');
    },

    getByStatus(status) {
      return stmts.findByStatus.all(status);
    },

    updateModDecision(id, { status, moderator_id, moderator_username, moderator_action, moderator_reason, execution_tx_id = null }) {
      const now = new Date().toISOString();
      return stmts.modDecide.run({
        id,
        status,
        moderator_id,
        moderator_username,
        moderator_action,
        moderator_reason: moderator_reason || null,
        moderator_decision_at: now,
        execution_tx_id: execution_tx_id || null,
        updated_at: now
      });
    },

    updateRootDecision(id, { status, root_id, root_username, root_action, execution_tx_id = null }) {
      const now = new Date().toISOString();
      return stmts.rootDecide.run({
        id,
        status,
        root_id,
        root_username,
        root_action,
        root_decision_at: now,
        execution_tx_id: execution_tx_id || null,
        updated_at: now
      });
    },

    listRecent(limit = 50) {
      return stmts.listAll.all(limit);
    }
  };
}

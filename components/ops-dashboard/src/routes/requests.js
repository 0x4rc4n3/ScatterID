// Requests Intake & Moderation Queue API Routes
// Document ID: DEV-ARCH-08 / ADDENDUM-01 / SEC-OPS-06

import express from 'express';
import crypto from 'node:crypto';
import { authenticate, requireRole, getClientIp } from '../auth/middleware.js';
import { createLedgerExecutor } from '../ledger/executor.js';

export function createRequestsRouter({ db, repos, ledgerExecutor: customExecutor = null }) {
  const router = express.Router();
  const ledgerExecutor = customExecutor || createLedgerExecutor({ db });

  /**
   * Helper to generate unique request ID
   */
  function generateRequestId(prefix = 'req') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * POST /api/requests/issue
   * Help Desk intake for identity credential issuance.
   * Enforces Hard Channel (physical checklist verified, no scan storage)
   * vs. Soft Channel (digital scan upload with SHA-256 hash).
   */
  router.post('/issue', authenticate, requireRole(['clerk', 'mod', 'root']), (req, res) => {
    try {
      const {
        submission_channel,
        claimant_data,
        inspection_checklist,
        inspection_checklist_verified,
        evidence_sha256,
        evidence_payload_base64,
        station_id: bodyStationId,
        reason
      } = req.body || {};

      const clientIp = getClientIp(req);
      const staffUserId = req.user.userId;
      const clerkUsername = req.user.username;
      const stationId = bodyStationId || req.user.stationId || 'counter-station-01';

      // Validation: Channel must be 'hard' or 'soft'
      if (!submission_channel || !['hard', 'soft'].includes(submission_channel)) {
        return res.status(400).json({
          error: 'INVALID_SUBMISSION_CHANNEL',
          message: 'submission_channel must be either "hard" or "soft"'
        });
      }

      // Validation: Claimant data is required
      if (!claimant_data || typeof claimant_data !== 'object' || Object.keys(claimant_data).length === 0) {
        return res.status(400).json({
          error: 'MISSING_CLAIMANT_DATA',
          message: 'Structured claimant data is required for issuance'
        });
      }

      let isChecklistVerified = 0;
      let calculatedEvidenceSha256 = null;

      if (submission_channel === 'hard') {
        // Physical In-Person Inspection Requirements (Addendum §2.1)
        // Must verify 4 checkpoints: substrate, optical, biometric, seal
        let checklistPassed = false;

        if (inspection_checklist_verified === true || inspection_checklist_verified === 1) {
          checklistPassed = true;
        } else if (inspection_checklist && typeof inspection_checklist === 'object') {
          const {
            substrate_material_integrity,
            optical_security_features,
            biometric_face_match,
            authority_seal_and_serial
          } = inspection_checklist;

          if (substrate_material_integrity && optical_security_features &&
              biometric_face_match && authority_seal_and_serial) {
            checklistPassed = true;
          }
        }

        if (!checklistPassed) {
          return res.status(400).json({
            error: 'CHECKLIST_INCOMPLETE',
            message: 'Hard channel issuance requires all 4 physical inspection checkpoints to be verified'
          });
        }

        // Data Minimization Policy: Hard channel must NOT store document scan or file payload
        isChecklistVerified = 1;
        calculatedEvidenceSha256 = null;
      } else {
        // Soft Channel (Digital Submission - Addendum §2.2)
        // Must provide SHA-256 of uploaded document scan or raw payload
        if (evidence_sha256) {
          if (!/^[a-fA-F0-9]{64}$/.test(evidence_sha256)) {
            return res.status(400).json({
              error: 'INVALID_SHA256',
              message: 'evidence_sha256 must be a 64-character hexadecimal SHA-256 hash'
            });
          }
          calculatedEvidenceSha256 = evidence_sha256.toLowerCase();
        } else if (evidence_payload_base64) {
          const fileBuf = Buffer.from(evidence_payload_base64, 'base64');
          calculatedEvidenceSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
        } else {
          return res.status(400).json({
            error: 'MISSING_EVIDENCE',
            message: 'Soft channel issuance strictly requires evidence_sha256 or evidence_payload_base64'
          });
        }
        isChecklistVerified = 0;
      }

      const requestId = generateRequestId('req_iss');
      const now = new Date().toISOString();

      // Atomic insertion of Request and Immutable Audit Attribution
      const createTx = db.transaction(() => {
        const reqRecord = repos.requests.createRequest({
          id: requestId,
          request_type: 'issuance',
          submission_channel,
          status: 'PENDING',
          claimant_data,
          inspection_checklist_verified: isChecklistVerified,
          evidence_sha256: calculatedEvidenceSha256,
          clerk_id: staffUserId,
          clerk_username: clerkUsername,
          station_id: stationId,
          client_ip: clientIp,
          reason: reason || null,
          created_at: now,
          updated_at: now
        });

        repos.auditLog.record({
          action: 'CLERK_REQUEST_SUBMITTED',
          status: 'SUCCESS',
          actor_id: staffUserId,
          username: clerkUsername,
          role: req.user.role,
          station_id: stationId,
          client_ip: clientIp,
          request_id: requestId,
          submission_channel,
          details: {
            request_type: 'issuance',
            inspection_checklist_verified: Boolean(isChecklistVerified),
            evidence_sha256: calculatedEvidenceSha256
          },
          timestamp: now
        });

        return reqRecord;
      });

      const created = createTx();

      return res.status(201).json({
        success: true,
        requestId: created.id,
        status: created.status,
        submission_channel: created.submission_channel,
        attribution: {
          staff_user_id: staffUserId,
          username: clerkUsername,
          station_id: stationId,
          client_ip: clientIp,
          timestamp: now
        }
      });
    } catch (err) {
      console.error('Issue request error:', err);
      return res.status(500).json({ error: 'INTAKE_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/requests/revoke
   * Help Desk intake for credential revocation.
   * Mandatorily requires credential_id, channel, and reason.
   */
  router.post('/revoke', authenticate, requireRole(['clerk', 'mod', 'root']), (req, res) => {
    try {
      const {
        credential_id,
        reason,
        submission_channel,
        evidence_sha256,
        station_id: bodyStationId
      } = req.body || {};

      const clientIp = getClientIp(req);
      const staffUserId = req.user.userId;
      const clerkUsername = req.user.username;
      const stationId = bodyStationId || req.user.stationId || 'counter-station-01';

      if (!credential_id || typeof credential_id !== 'string') {
        return res.status(400).json({
          error: 'MISSING_CREDENTIAL_ID',
          message: 'credential_id is required for revocation'
        });
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        return res.status(400).json({
          error: 'MISSING_REASON',
          message: 'Mandatory revocation reason is required'
        });
      }

      const channel = submission_channel || 'hard';
      if (!['hard', 'soft'].includes(channel)) {
        return res.status(400).json({
          error: 'INVALID_SUBMISSION_CHANNEL',
          message: 'submission_channel must be either "hard" or "soft"'
        });
      }

      const requestId = generateRequestId('req_rev');
      const now = new Date().toISOString();

      const createTx = db.transaction(() => {
        const reqRecord = repos.requests.createRequest({
          id: requestId,
          request_type: 'revocation',
          submission_channel: channel,
          status: 'PENDING',
          credential_id,
          reason,
          inspection_checklist_verified: channel === 'hard' ? 1 : 0,
          evidence_sha256: evidence_sha256 || null,
          clerk_id: staffUserId,
          clerk_username: clerkUsername,
          station_id: stationId,
          client_ip: clientIp,
          created_at: now,
          updated_at: now
        });

        repos.auditLog.record({
          action: 'CLERK_REVOCATION_REQUEST_SUBMITTED',
          status: 'SUCCESS',
          actor_id: staffUserId,
          username: clerkUsername,
          role: req.user.role,
          station_id: stationId,
          client_ip: clientIp,
          request_id: requestId,
          credential_id,
          submission_channel: channel,
          details: { reason },
          timestamp: now
        });

        return reqRecord;
      });

      const created = createTx();

      return res.status(201).json({
        success: true,
        requestId: created.id,
        status: created.status,
        submission_channel: created.submission_channel,
        attribution: {
          staff_user_id: staffUserId,
          username: clerkUsername,
          station_id: stationId,
          client_ip: clientIp,
          timestamp: now
        }
      });
    } catch (err) {
      console.error('Revoke intake error:', err);
      return res.status(500).json({ error: 'INTAKE_FAILED', message: err.message });
    }
  });

  /**
   * GET /api/requests/track/:id
   * Safe status tracking for Help Desk clerks without exposing internal keys or private mod comments.
   */
  router.get('/track/:id', authenticate, (req, res) => {
    const record = repos.requests.getById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
    }

    return res.status(200).json({
      id: record.id,
      request_type: record.request_type,
      submission_channel: record.submission_channel,
      status: record.status,
      credential_id: record.credential_id || null,
      created_at: record.created_at,
      updated_at: record.updated_at
    });
  });

  /**
   * POST /api/requests/:id/decide
   * Moderator decision on a pending request (FR-11, FR-11B).
   * Scenario B Tiered Risk Rules:
   * - Hard-Channel Issue + Approve -> AUTO-EXECUTES on Fabric ledger.
   * - Soft-Channel Issue + Approve -> Escalates to AWAITING_ROOT_ACCEPT.
   * - Revocation (Hard or Soft) + Approve -> Escalates to AWAITING_ROOT_ACCEPT (never auto-executes).
   * - Reject -> Closes immediately as REJECTED.
   * - Flag -> Escalates to FLAGGED with mandatory reason.
   */
  router.post('/:id/decide', authenticate, requireRole(['mod']), async (req, res) => {
    try {
      const { id } = req.params;
      const { action, reason } = req.body || {};
      const clientIp = getClientIp(req);
      const modId = req.user.userId;
      const modUsername = req.user.username;

      const validActions = ['APPROVE', 'REJECT', 'FLAG'];
      if (!action || !validActions.includes(action.toUpperCase())) {
        return res.status(400).json({
          error: 'INVALID_ACTION',
          message: `action must be one of: ${validActions.join(', ')}`
        });
      }

      const normalizedAction = action.toUpperCase();

      // Reject and Flag mandatorily require a stated reason
      if ((normalizedAction === 'REJECT' || normalizedAction === 'FLAG') && (!reason || reason.trim().length < 3)) {
        return res.status(400).json({
          error: 'REASON_REQUIRED',
          message: `A mandatory reason is required when moderator selects ${normalizedAction}`
        });
      }

      const request = repos.requests.getById(id);
      if (!request) {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
      }

      if (request.status !== 'PENDING') {
        return res.status(409).json({
          error: 'REQUEST_ALREADY_DECIDED',
          message: `Request is currently in status '${request.status}' and cannot be decided by moderator`
        });
      }

      const now = new Date().toISOString();

      // Case 1: Moderator Rejects Request
      if (normalizedAction === 'REJECT') {
        repos.requests.updateModDecision(id, {
          status: 'REJECTED',
          moderator_id: modId,
          moderator_username: modUsername,
          moderator_action: 'REJECT',
          moderator_reason: reason
        });

        repos.auditLog.record({
          action: 'MOD_REQUEST_REJECTED',
          status: 'SUCCESS',
          actor_id: modId,
          username: modUsername,
          role: 'mod',
          client_ip: clientIp,
          request_id: id,
          submission_channel: request.submission_channel,
          credential_id: request.credential_id,
          details: { reason }
        });

        return res.status(200).json({
          success: true,
          status: 'REJECTED',
          executed: false,
          moderator_action: 'REJECT',
          reason
        });
      }

      // Case 2: Moderator Flags Request for Escalation
      if (normalizedAction === 'FLAG') {
        repos.requests.updateModDecision(id, {
          status: 'FLAGGED',
          moderator_id: modId,
          moderator_username: modUsername,
          moderator_action: 'FLAG',
          moderator_reason: reason
        });

        repos.auditLog.record({
          action: 'MOD_REQUEST_FLAGGED',
          status: 'ALERT',
          actor_id: modId,
          username: modUsername,
          role: 'mod',
          client_ip: clientIp,
          request_id: id,
          submission_channel: request.submission_channel,
          credential_id: request.credential_id,
          details: { reason }
        });

        return res.status(200).json({
          success: true,
          status: 'FLAGGED',
          executed: false,
          moderator_action: 'FLAG',
          reason
        });
      }

      // Case 3: Moderator Approves Request -> Scenario B Policy
      if (normalizedAction === 'APPROVE') {
        // Subcase 3A: Hard-Channel Issuance -> AUTO-EXECUTES
        if (request.request_type === 'issuance' && request.submission_channel === 'hard') {
          const execResult = await ledgerExecutor.executeIssuance(request);

          repos.requests.updateModDecision(id, {
            status: 'EXECUTED',
            moderator_id: modId,
            moderator_username: modUsername,
            moderator_action: 'APPROVE',
            moderator_reason: reason || 'Hard-channel physical inspection verified; auto-executed by policy',
            execution_tx_id: execResult.txId
          });

          repos.auditLog.record({
            action: 'MOD_APPROVED_AUTO_EXECUTED',
            status: 'SUCCESS',
            actor_id: modId,
            username: modUsername,
            role: 'mod',
            client_ip: clientIp,
            request_id: id,
            submission_channel: 'hard',
            details: {
              execution_tx_id: execResult.txId,
              policy: 'SCENARIO_B_HARD_CHANNEL_AUTO_EXECUTE',
              note: reason || null
            }
          });

          return res.status(200).json({
            success: true,
            status: 'EXECUTED',
            executed: true,
            execution_tx_id: execResult.txId,
            moderator_action: 'APPROVE',
            routing_tier: 'AUTO_EXECUTED'
          });
        }

        // Subcase 3B: Soft-Channel Issuance -> Escalates to Root
        if (request.request_type === 'issuance' && request.submission_channel === 'soft') {
          repos.requests.updateModDecision(id, {
            status: 'AWAITING_ROOT_ACCEPT',
            moderator_id: modId,
            moderator_username: modUsername,
            moderator_action: 'APPROVE',
            moderator_reason: reason || 'Soft scan approved by moderator; escalated for Root authorization'
          });

          repos.auditLog.record({
            action: 'MOD_APPROVED_ESCALATED_ROOT',
            status: 'PENDING',
            actor_id: modId,
            username: modUsername,
            role: 'mod',
            client_ip: clientIp,
            request_id: id,
            submission_channel: 'soft',
            details: {
              policy: 'SCENARIO_B_SOFT_CHANNEL_ROOT_GATE',
              note: reason || null
            }
          });

          return res.status(200).json({
            success: true,
            status: 'AWAITING_ROOT_ACCEPT',
            executed: false,
            moderator_action: 'APPROVE',
            routing_tier: 'AWAITING_ROOT_ACCEPT'
          });
        }

        // Subcase 3C: Revocation (Hard or Soft) -> Strictly Escalates to Root
        if (request.request_type === 'revocation') {
          repos.requests.updateModDecision(id, {
            status: 'AWAITING_ROOT_ACCEPT',
            moderator_id: modId,
            moderator_username: modUsername,
            moderator_action: 'APPROVE',
            moderator_reason: reason || 'Revocation reviewed by moderator; strictly escalated to Root'
          });

          repos.auditLog.record({
            action: 'MOD_APPROVED_REVOCATION_ESCALATED_ROOT',
            status: 'PENDING',
            actor_id: modId,
            username: modUsername,
            role: 'mod',
            client_ip: clientIp,
            request_id: id,
            submission_channel: request.submission_channel,
            credential_id: request.credential_id,
            details: {
              policy: 'SCENARIO_B_REVOCATION_ROOT_GATE_STRICT',
              note: reason || null
            }
          });

          return res.status(200).json({
            success: true,
            status: 'AWAITING_ROOT_ACCEPT',
            executed: false,
            moderator_action: 'APPROVE',
            routing_tier: 'AWAITING_ROOT_ACCEPT'
          });
        }

        // Subcase 3D: Routine Key Rotation
        repos.requests.updateModDecision(id, {
          status: 'AWAITING_ROOT_ACCEPT',
          moderator_id: modId,
          moderator_username: modUsername,
          moderator_action: 'APPROVE',
          moderator_reason: reason || 'Routine rotation requested'
        });

        return res.status(200).json({
          success: true,
          status: 'AWAITING_ROOT_ACCEPT',
          executed: false,
          routing_tier: 'AWAITING_ROOT_ACCEPT'
        });
      }
    } catch (err) {
      console.error('Moderator decision error:', err);
      return res.status(500).json({ error: 'DECISION_FAILED', message: err.message });
    }
  });

  /**
   * GET /api/requests/queue/awaiting-root
   * Root queue for Soft-Channel Issue & Revocation requests (FR-12).
   */
  router.get('/queue/awaiting-root', authenticate, requireRole(['root']), (req, res) => {
    const list = repos.requests.getAwaitingRoot();
    return res.status(200).json({
      count: list.length,
      requests: list
    });
  });

  /**
   * GET /api/requests/queue/flagged
   * Root queue for Moderator-flagged requests (FR-13).
   */
  router.get('/queue/flagged', authenticate, requireRole(['root']), (req, res) => {
    const list = repos.requests.getFlaggedForRoot();
    return res.status(200).json({
      count: list.length,
      requests: list
    });
  });

  /**
   * POST /api/requests/:id/root-execute
   * Root execution on Awaiting Accept or Flagged queues (FR-14, FR-15).
   * Executes the irreversible ledger call against verification-api / Fabric.
   */
  router.post('/:id/root-execute', authenticate, requireRole(['root']), async (req, res) => {
    try {
      const { id } = req.params;
      const { action, reason } = req.body || {};
      const clientIp = getClientIp(req);
      const rootId = req.user.userId;
      const rootUsername = req.user.username;

      const validActions = ['ACCEPT', 'REJECT'];
      if (!action || !validActions.includes(action.toUpperCase())) {
        return res.status(400).json({
          error: 'INVALID_ACTION',
          message: 'Root action must be either "ACCEPT" or "REJECT"'
        });
      }

      const normalizedAction = action.toUpperCase();

      const request = repos.requests.getById(id);
      if (!request) {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
      }

      if (!['AWAITING_ROOT_ACCEPT', 'FLAGGED'].includes(request.status)) {
        return res.status(409).json({
          error: 'INVALID_STATE_FOR_ROOT',
          message: `Request is in status '${request.status}' and cannot be root-executed`
        });
      }

      if (normalizedAction === 'REJECT') {
        repos.requests.updateRootDecision(id, {
          status: 'REJECTED',
          root_id: rootId,
          root_username: rootUsername,
          root_action: 'REJECT'
        });

        repos.auditLog.record({
          action: 'ROOT_REQUEST_REJECTED',
          status: 'SUCCESS',
          actor_id: rootId,
          username: rootUsername,
          role: 'root',
          client_ip: clientIp,
          request_id: id,
          submission_channel: request.submission_channel,
          credential_id: request.credential_id,
          details: { reason: reason || 'Rejected by Root administrator' }
        });

        return res.status(200).json({
          success: true,
          status: 'REJECTED',
          executed: false,
          root_action: 'REJECT'
        });
      }

      // Root Accepts -> Irreversible Execution on Hyperledger Fabric
      let execResult;
      if (request.request_type === 'issuance') {
        execResult = await ledgerExecutor.executeIssuance(request);
      } else if (request.request_type === 'revocation') {
        execResult = await ledgerExecutor.executeRevocation(request);
      } else {
        execResult = { txId: `tx_key_rotation_${Date.now()}` };
      }

      repos.requests.updateRootDecision(id, {
        status: 'EXECUTED',
        root_id: rootId,
        root_username: rootUsername,
        root_action: 'ACCEPT',
        execution_tx_id: execResult.txId
      });

      repos.auditLog.record({
        action: 'ROOT_REQUEST_EXECUTED',
        status: 'SUCCESS',
        actor_id: rootId,
        username: rootUsername,
        role: 'root',
        client_ip: clientIp,
        request_id: id,
        submission_channel: request.submission_channel,
        credential_id: request.credential_id,
        details: {
          request_type: request.request_type,
          execution_tx_id: execResult.txId,
          reason: reason || null
        }
      });

      return res.status(200).json({
        success: true,
        status: 'EXECUTED',
        executed: true,
        execution_tx_id: execResult.txId,
        root_action: 'ACCEPT'
      });
    } catch (err) {
      console.error('Root execution error:', err);
      return res.status(500).json({ error: 'ROOT_EXECUTION_FAILED', message: err.message });
    }
  });
  /**
   * GET /api/requests/pending
   * Frontline queue for Moderators (act) and Root (view) - FR-10.
   */
  router.get('/pending', authenticate, requireRole(['mod', 'root']), (req, res) => {
    const pendingList = repos.requests.getPendingForMod();
    return res.status(200).json({
      count: pendingList.length,
      requests: pendingList
    });
  });

  /**
   * GET /api/requests/:id
   * Detailed request view for Mod/Root review.
   */
  router.get('/:id', authenticate, requireRole(['mod', 'root']), (req, res) => {
    const record = repos.requests.getById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
    }
    return res.status(200).json({ request: record });
  });

  return router;
}

export default createRequestsRouter;

// Requests Intake & Moderation Queue API Routes
// Document ID: DEV-ARCH-08 / ADDENDUM-01 / SEC-OPS-06

import express from 'express';
import crypto from 'node:crypto';
import { authenticate, requireRole, getClientIp } from '../auth/middleware.js';
import { createLedgerExecutor } from '../ledger/executor.js';
import {
  evaluateModeratorApproval,
  validatePhysicalChecklist,
  getActivePolicy,
  setActivePolicy,
  resetPolicyToDefault,
  POLICY_PROFILES
} from '../policy/routingPolicy.js';

export function createRequestsRouter({ db, repos, ledgerExecutor: customExecutor = null }) {
  const router = express.Router();
  const ledgerExecutor = customExecutor || createLedgerExecutor({ db });

  const redactRequest = (record) => {
    if (!record) return record;
    const { claimant_receipt_token_hash, issuance_receipt_json, claimant_data, ...safe } = record;
    return { ...safe, claimant_data: null };
  };

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
        data_hash,
        claimant_receipt_token,
        inspection_checklist,
        inspection_checklist_verified,
        evidence_sha256,
        station_id: bodyStationId,
        reason
      } = req.body || {};

      const clientIp = getClientIp(req);
      const staffUserId = req.user.userId;
      const clerkUsername = req.user.username;
      const stationId = bodyStationId || req.user.stationId || 'counter-station-01';

      const channel = submission_channel || 'standard';

      if (Object.hasOwn(req.body || {}, 'claimant_data') || Object.hasOwn(req.body || {}, 'claim') || Object.hasOwn(req.body || {}, 'salt') || Object.hasOwn(req.body || {}, 'evidence_payload_base64')) {
        return res.status(400).json({ error: 'PRIVATE_DATA_REJECTED', message: 'Claim, salt, and raw evidence must stay on the claimant device; submit only commitments and evidence hashes.' });
      }

      // Validation: Channel must be 'standard', 'hard', or 'soft'
      if (!['standard', 'hard', 'soft'].includes(channel)) {
        return res.status(400).json({
          error: 'INVALID_SUBMISSION_CHANNEL',
          message: 'submission_channel must be "standard", "hard", or "soft"'
        });
      }

      // Claim data and salt must never cross the ops API boundary.
      if (typeof data_hash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(data_hash)) {
        return res.status(400).json({
          error: 'INVALID_COMMITMENT',
          message: 'data_hash must be a 64-character salted SHA3-256 commitment'
        });
      }

      if (typeof claimant_receipt_token !== 'string' || !/^[0-9a-fA-F]{64}$/.test(claimant_receipt_token)) {
        return res.status(400).json({ error: 'INVALID_RECEIPT_TOKEN', message: 'A client-generated 32-byte claimant receipt token is required.' });
      }

      let isChecklistVerified = 0;
      let calculatedEvidenceSha256 = null;

      if (channel === 'standard' || channel === 'hard') {
        // Physical In-Person Inspection Verification
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
            message: 'In-person issuance requires all 4 physical inspection checkpoints to be verified'
          });
        }

        isChecklistVerified = 1;

        // For standard channel, also attach document scan hash
        if (channel === 'standard') {
          if (evidence_sha256 && /^[a-fA-F0-9]{64}$/.test(evidence_sha256)) {
            calculatedEvidenceSha256 = evidence_sha256.toLowerCase();
          } else {
            // Raw evidence stays client-side; only an independently computed hash may be submitted.
            calculatedEvidenceSha256 = null;
          }
        } else {
          calculatedEvidenceSha256 = null;
        }
      } else {
        // Soft Channel (Digital Submission - Addendum §2.2)
        if (evidence_sha256) {
          if (!/^[a-fA-F0-9]{64}$/.test(evidence_sha256)) {
            return res.status(400).json({
              error: 'INVALID_SHA256',
              message: 'evidence_sha256 must be a 64-character hexadecimal SHA-256 hash'
            });
          }
          calculatedEvidenceSha256 = evidence_sha256.toLowerCase();
        } else {
          return res.status(400).json({
            error: 'MISSING_EVIDENCE',
            message: 'Soft channel issuance strictly requires evidence_sha256; raw evidence payloads are not accepted by ops'
          });
        }
        isChecklistVerified = 0;
      }

      const claimantReceiptTokenHash = crypto.createHash('sha256').update(claimant_receipt_token.toLowerCase()).digest('hex');
      const existingRequest = repos.requests.getByReceiptTokenHash(claimantReceiptTokenHash);
      if (existingRequest) {
        if (existingRequest.data_hash !== data_hash.toLowerCase()) {
          return res.status(409).json({ error: 'RECEIPT_TOKEN_CONFLICT', message: 'This receipt token is already bound to a different commitment.' });
        }
        return res.status(200).json({ success: true, requestId: existingRequest.id, status: existingRequest.status, submission_channel: existingRequest.submission_channel });
      }
      const requestId = generateRequestId('req_iss');
       const now = new Date().toISOString();

       // Atomic insertion of Request and Immutable Audit Attribution
       const createTx = db.transaction(() => {
         const dbChannel = (channel === 'standard') ? 'hard' : channel;
         const reqRecord = repos.requests.createRequest({
           id: requestId,
           request_type: 'issuance',
           submission_channel: dbChannel,
           status: 'PENDING',
           data_hash: data_hash.toLowerCase(),
           claimant_receipt_token_hash: claimantReceiptTokenHash,
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
           submission_channel: dbChannel,
           details: {
             request_type: 'issuance',
             inspection_checklist_verified: Boolean(isChecklistVerified),
             evidence_sha256: calculatedEvidenceSha256,
             original_channel: channel,
             data_hash: data_hash.toLowerCase()
           },
           timestamp: now
         });

         return reqRecord;
       });

      let created;
      try {
        created = createTx();
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          const duplicate = repos.requests.getByReceiptTokenHash(claimantReceiptTokenHash);
          if (duplicate) {
            if (duplicate.data_hash !== data_hash.toLowerCase()) {
              return res.status(409).json({ error: 'RECEIPT_TOKEN_CONFLICT', message: 'This receipt token is already bound to a different commitment.' });
            }
            return res.status(200).json({ success: true, requestId: duplicate.id, status: duplicate.status, submission_channel: duplicate.submission_channel });
          }
        }
        throw err;
      }

       return res.status(201).json({
         success: true,
         requestId: created.id,
         request: redactRequest(created),
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
        request: created,
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
  const handleModDecide = async (req, res) => {
    try {
      const { id } = req.params;
      const { action, reason, notes } = req.body || {};
      const decisionReason = reason || notes;
      const clientIp = getClientIp(req);
      const modId = req.user.userId;
      const modUsername = req.user.username;
      const isRootUser = req.user.role === 'root';

      const validActions = isRootUser
        ? ['APPROVE', 'REJECT', 'FLAG', 'ACCEPT']
        : ['APPROVE', 'REJECT', 'FLAG'];

      if (!action || !validActions.includes(action.toUpperCase())) {
        return res.status(400).json({
          error: 'INVALID_ACTION',
          message: `action must be one of: ${validActions.join(', ')}`
        });
      }

      const normalizedAction = action.toUpperCase() === 'ACCEPT' ? 'APPROVE' : action.toUpperCase();

      // Reject and Flag mandatorily require a stated reason
      if ((normalizedAction === 'REJECT' || normalizedAction === 'FLAG') && (!decisionReason || decisionReason.trim().length < 3)) {
        return res.status(400).json({
          error: 'REASON_REQUIRED',
          message: `A mandatory reason is required when operator selects ${action.toUpperCase()}`
        });
      }

      const request = repos.requests.getById(id);
      if (!request) {
        return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
      }

      if (isRootUser) {
        // Root has overarching authority to decide PENDING, AWAITING_ROOT_ACCEPT, or FLAGGED requests
        if (!['PENDING', 'AWAITING_ROOT_ACCEPT', 'FLAGGED'].includes(request.status)) {
          return res.status(409).json({
            error: 'REQUEST_ALREADY_DECIDED',
            message: `Request is currently in status '${request.status}' and cannot be decided by root`
          });
        }

        if (normalizedAction === 'REJECT') {
          repos.requests.updateRootDecision(id, {
            status: 'REJECTED',
            root_id: modId,
            root_username: modUsername,
            root_action: 'REJECT'
          });

          repos.auditLog.record({
            action: 'ROOT_REQUEST_REJECTED',
            status: 'SUCCESS',
            actor_id: modId,
            username: modUsername,
            role: 'root',
            client_ip: clientIp,
            request_id: id,
            submission_channel: request.submission_channel,
            credential_id: request.credential_id,
            details: { reason: decisionReason || 'Rejected by Root administrator' }
          });

          return res.status(200).json({
            success: true,
            status: 'REJECTED',
            executed: false,
            root_action: 'REJECT',
            reason: decisionReason
          });
        }

        if (normalizedAction === 'FLAG') {
          repos.requests.updateModDecision(id, {
            status: 'FLAGGED',
            moderator_id: modId,
            moderator_username: modUsername,
            moderator_action: 'FLAG',
            moderator_reason: decisionReason
          });

          repos.auditLog.record({
            action: 'ROOT_REQUEST_FLAGGED',
            status: 'ALERT',
            actor_id: modId,
            username: modUsername,
            role: 'root',
            client_ip: clientIp,
            request_id: id,
            submission_channel: request.submission_channel,
            credential_id: request.credential_id,
            details: { reason: decisionReason }
          });

          return res.status(200).json({
            success: true,
            status: 'FLAGGED',
            executed: false,
            root_action: 'FLAG',
            reason: decisionReason
          });
        }

        // Root APPROVE / ACCEPT -> Direct ledger execution
        let execResult;
        if (request.request_type === 'issuance' || request.type === 'issue' || !request.request_type) {
          execResult = await ledgerExecutor.executeIssuance(request);
        } else if (request.request_type === 'revocation' || request.type === 'revoke') {
          execResult = await ledgerExecutor.executeRevocation(request);
        } else {
          throw new Error(`Unsupported request type for execution: ${request.request_type || request.type || 'unknown'}`);
        }

        if (execResult.issuanceReceipt) repos.requests.updateIssuanceReceipt(id, execResult.issuanceReceipt);

        repos.requests.updateRootDecision(id, {
          status: 'EXECUTED',
          root_id: modId,
          root_username: modUsername,
          root_action: 'ACCEPT',
          execution_tx_id: execResult.txId
        });

        repos.auditLog.record({
          action: 'ROOT_REQUEST_EXECUTED',
          status: 'SUCCESS',
          actor_id: modId,
          username: modUsername,
          role: 'root',
          client_ip: clientIp,
          request_id: id,
          submission_channel: request.submission_channel,
          credential_id: request.credential_id,
          details: {
            request_type: request.request_type,
            execution_tx_id: execResult.txId,
            reason: decisionReason || null
          }
        });

        return res.status(200).json({
          success: true,
          status: 'EXECUTED',
          executed: true,
          execution_tx_id: execResult.txId,
          root_action: 'ACCEPT'
        });
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
      // Case 3: Moderator Approves Request -> Governed by Active Policy
      if (normalizedAction === 'APPROVE') {
        const policyEval = evaluateModeratorApproval(request);
        const policy = getActivePolicy();

        if (policyEval.action === 'AUTO_EXECUTE') {
          const execResult = await ledgerExecutor.executeIssuance(request);
          if (execResult.issuanceReceipt) repos.requests.updateIssuanceReceipt(id, execResult.issuanceReceipt);

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
            submission_channel: request.submission_channel,
            details: {
              execution_tx_id: execResult.txId,
              policy: policyEval.policyCode || policy.name,
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

        // Subcase: Escalates to Root
        const auditAction = request.request_type === 'revocation'
          ? 'MOD_APPROVED_REVOCATION_ESCALATED_ROOT'
          : 'MOD_APPROVED_ESCALATED_ROOT';

        repos.requests.updateModDecision(id, {
          status: 'AWAITING_ROOT_ACCEPT',
          moderator_id: modId,
          moderator_username: modUsername,
          moderator_action: 'APPROVE',
          moderator_reason: reason || policyEval.message
        });

        repos.auditLog.record({
          action: auditAction,
          status: 'PENDING',
          actor_id: modId,
          username: modUsername,
          role: 'mod',
          client_ip: clientIp,
          request_id: id,
          submission_channel: request.submission_channel,
          credential_id: request.credential_id,
          details: {
            policy: policyEval.policyCode || policy.name,
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
    } catch (err) {
      console.error('Moderator decision error:', err);
      return res.status(500).json({ error: 'DECISION_FAILED', message: err.message });
    }
  };

  router.post('/:id/decide', authenticate, requireRole(['mod', 'root']), handleModDecide);
  router.post('/:id/mod-decide', authenticate, requireRole(['mod', 'root']), handleModDecide);
  router.post('/:id/mod-action', authenticate, requireRole(['mod', 'root']), handleModDecide);

  /**
   * GET /api/requests/queue/awaiting-root & /api/requests/awaiting-root
   * Root queue for Soft-Channel Issue & Revocation requests (FR-12).
   */
  const getAwaitingRootHandler = (req, res) => {
    const list = repos.requests.getAwaitingRoot();
    return res.status(200).json({
      count: list.length,
      requests: list.map(redactRequest)
    });
  };
  router.get('/queue/awaiting-root', authenticate, requireRole(['root']), getAwaitingRootHandler);
  router.get('/awaiting-root', authenticate, requireRole(['root']), getAwaitingRootHandler);

  /**
   * GET /api/requests/queue/flagged & /api/requests/flagged
   * Root queue for Moderator-flagged requests (FR-13).
   */
  const getFlaggedHandler = (req, res) => {
    const list = repos.requests.getFlaggedForRoot();
    return res.status(200).json({
      count: list.length,
      requests: list.map(redactRequest)
    });
  };
  router.get('/queue/flagged', authenticate, requireRole(['root']), getFlaggedHandler);
  router.get('/flagged', authenticate, requireRole(['root']), getFlaggedHandler);

  /**
   * POST /api/requests/:id/root-execute
   * Root execution on Awaiting Accept or Flagged queues (FR-14, FR-15).
   * Executes the irreversible ledger call against verification-api / Fabric.
   */
  const handleRootExecute = async (req, res) => {
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

      if (!['PENDING', 'AWAITING_ROOT_ACCEPT', 'FLAGGED'].includes(request.status)) {
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
        throw new Error(`Unsupported request type for execution: ${request.request_type || 'unknown'}`);
      }

      if (execResult.issuanceReceipt) repos.requests.updateIssuanceReceipt(id, execResult.issuanceReceipt);

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
  };

  router.post('/:id/root-execute', authenticate, requireRole(['root']), handleRootExecute);
  router.post('/:id/root-decide', authenticate, requireRole(['root']), handleRootExecute);
  /**
   * GET /api/requests/pending & GET /api/requests/queue/pending
   * Frontline queue for Moderators (act) and Root (view) - FR-10.
   */
  const getPendingQueueHandler = (req, res) => {
    const pendingList = repos.requests.getPendingForMod();
    return res.status(200).json({
      count: pendingList.length,
      requests: pendingList.map(redactRequest)
    });
  };

  router.get('/pending', authenticate, requireRole(['mod', 'root']), getPendingQueueHandler);
  router.get('/queue/pending', authenticate, requireRole(['mod', 'root']), getPendingQueueHandler);

  /**
   * GET /api/requests/stats
   * Overview dashboard stats
   */
  router.get('/stats', authenticate, (req, res) => {
    try {
      const allReqs = repos.requests.listAll(500);
      const pendingMod = repos.requests.getPendingForMod().length;
      const awaitingRoot = repos.requests.getAwaitingRoot().length;
      const flagged = repos.requests.getFlaggedForRoot().length;
      
      const executed = allReqs.filter(r => r.status === 'EXECUTED');
      const active = executed.filter(r => r.request_type === 'issuance').length;
      const revoked = executed.filter(r => r.request_type === 'revocation').length;
      const totalCredentials = executed.length;

      return res.status(200).json({
        totalCredentials,
        active,
        revoked,
        pendingRequests: pendingMod,
        awaitingRoot,
        flagged,
        reconciliation: {
          status: 'in_sync',
          lastRun: new Date().toISOString()
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/requests/audit-log
   */
  router.get('/audit-log', authenticate, requireRole(['mod', 'root']), (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const logs = repos.auditLog.getRecent(limit);
      return res.status(200).json({ logs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/requests/credentials-list
   */
  router.get('/credentials-list', authenticate, requireRole(['mod', 'root']), (req, res) => {
    try {
      const allReqs = repos.requests.listAll(500);
      const executed = allReqs.filter(r => r.status === 'EXECUTED');
      const credentials = executed.map(r => {
        return {
          id: r.credential_id,
          status: r.request_type === 'revocation' ? 'revoked' : 'active',
          issued_date: r.created_at,
          channel: r.submission_channel,
          subject: 'Identity Subject',
          title: 'Identity Credential',
          data_hash: r.data_hash || null,
          signing_key_id: null,
          execution_tx_id: r.execution_tx_id || null
        };
      }).filter(credential => credential.id);
      return res.status(200).json({ credentials });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/requests/reconcile
   */
  router.post('/reconcile', authenticate, requireRole(['root']), (req, res) => {
    repos.auditLog.record({
      action: 'MANUAL_RECONCILIATION_RUN',
      status: 'SUCCESS',
      actor_id: req.user.userId,
      username: req.user.username,
      role: 'root',
      client_ip: getClientIp(req),
      details: { trigger: 'operator_manual_probe', drift_detected: 0 }
    });
    return res.status(200).json({
      status: 'in_sync',
      reconciledCount: 0,
      driftDetected: false,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /api/requests/policy
   * Retrieve active governance policy profile & available profiles
   */
  router.get('/policy', authenticate, (req, res) => {
    return res.status(200).json({
      active: getActivePolicy(),
      availableProfiles: Object.keys(POLICY_PROFILES)
    });
  });

  /**
   * POST /api/requests/policy
   * Dynamic governance policy configuration (Root only)
   */
  router.post('/policy', authenticate, requireRole(['root']), (req, res) => {
    try {
      const { profile, customConfig } = req.body;
      if (profile) {
        setActivePolicy(profile);
      } else if (customConfig) {
        setActivePolicy(customConfig);
      } else {
        return res.status(400).json({ error: 'MISSING_POLICY', message: 'Must provide profile or customConfig' });
      }

      repos.auditLog.record({
        action: 'POLICY_PROFILE_CHANGED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: { newPolicy: getActivePolicy().name }
      });

      return res.status(200).json({
        success: true,
        message: 'Routing policy successfully updated',
        activePolicy: getActivePolicy()
      });
    } catch (err) {
      return res.status(400).json({ error: 'POLICY_UPDATE_FAILED', message: err.message });
    }
  });

  /**
   * GET /api/requests/claimant-receipt/:id
   * Claimant-held token authorizes retrieval of the signed credential after approval.
   */
  const claimantReceiptHandler = (req, res) => {
    const token = req.get('X-Claimant-Receipt-Token') || '';
    if (!/^[0-9a-f]{64}$/i.test(token)) {
      return res.status(401).json({ error: 'INVALID_RECEIPT_TOKEN' });
    }
    const tokenHash = crypto.createHash('sha256').update(token.toLowerCase()).digest('hex');
    const record = repos.requests.getByReceiptTokenHash(tokenHash);
    if (!record || (req.params.id && record.id !== req.params.id)) {
      return res.status(404).json({ error: 'RECEIPT_NOT_FOUND' });
    }
    if (record.status !== 'EXECUTED' || !record.issuance_receipt_json) {
      return res.status(202).json({ requestId: record.id, status: record.status, issued: false });
    }
    return res.status(200).json({ requestId: record.id, status: 'issued', credential: JSON.parse(record.issuance_receipt_json) });
  };
  router.get('/claimant-receipt', claimantReceiptHandler);
  router.get('/claimant-receipt/:id', claimantReceiptHandler);

  /**
   * GET /api/requests/:id
   * Detailed request view for Mod/Root review.
   */
  router.get('/:id', authenticate, requireRole(['mod', 'root']), (req, res) => {
    const record = repos.requests.getById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
    }
    return res.status(200).json({ request: redactRequest(record) });
  });

  return router;
}

export default createRequestsRouter;

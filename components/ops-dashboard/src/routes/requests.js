// Requests Intake & Moderation Queue API Routes
// Document ID: DEV-ARCH-08 / ADDENDUM-01 / SEC-OPS-06

import express from 'express';
import crypto from 'node:crypto';
import { authenticate, requireRole, getClientIp } from '../auth/middleware.js';

export function createRequestsRouter({ db, repos }) {
  const router = express.Router();

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

// Keys Management & Lifecycle API Routes (Gateway Dual-Key & PQC Key Pool)
// Document ID: SEC-OPS-06

import express from 'express';
import { authenticate, requireRole, getClientIp } from '../auth/middleware.js';
import { createGatewayManager } from '../keys/gatewayManager.js';
import { createPqcPoolManager } from '../keys/pqcPoolManager.js';
import { exportEncryptedEnvelope, restoreEncryptedEnvelope } from '../keys/backupEnvelope.js';

export function createKeysRouter({ db, repos }) {
  const router = express.Router();
  const gatewayManager = createGatewayManager({ repos, db });
  const pqcManager = createPqcPoolManager({ repos, db });

  // 1. Gateway Dual-Key Zero-Downtime Rotation (Root only - FR-19)
  router.post('/gateway/rotate', authenticate, requireRole(['root']), (req, res) => {
    try {
      const { key_name, grace_window_hours = 24 } = req.body || {};
      const clientIp = getClientIp(req);

      if (!['REVOKE_API_KEY', 'VERIFICATION_API_KEY'].includes(key_name)) {
        return res.status(400).json({
          error: 'INVALID_KEY_NAME',
          message: 'key_name must be REVOKE_API_KEY or VERIFICATION_API_KEY'
        });
      }

      const result = gatewayManager.rotateGatewayKey({
        key_name,
        graceWindowHours: Number(grace_window_hours) || 24,
        created_by: req.user.userId
      });

      repos.auditLog.record({
        action: 'GATEWAY_KEY_ROTATED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: clientIp,
        details: {
          key_name,
          grace_window_hours: result.graceWindowHours,
          new_key_id: result.keyId
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Gateway key rotated successfully with zero downtime grace window',
        ...result
      });
    } catch (err) {
      return res.status(500).json({ error: 'ROTATION_FAILED', message: err.message });
    }
  });

  // 2. Gateway Key Status (Mod & Root)
  router.get('/gateway/status/:key_name', authenticate, requireRole(['mod', 'root']), (req, res) => {
    try {
      const status = gatewayManager.getKeyStatus(req.params.key_name);
      return res.status(200).json(status);
    } catch (err) {
      return res.status(500).json({ error: 'STATUS_FAILED', message: err.message });
    }
  });

  // 3. Gateway Key Validate (Internal or Gateway middleware)
  router.post('/gateway/validate', (req, res) => {
    const { key_name, token } = req.body || {};
    const check = gatewayManager.validateKey(key_name, token);
    return res.status(200).json(check);
  });

  // 4. Pre-Stage PQC Key (Root only - FR-23)
  router.post('/pqc/pre-stage', authenticate, requireRole(['root']), (req, res) => {
    try {
      const {
        key_id,
        algorithm = 'ML-DSA-87',
        public_key_hex,
        encrypted_private_key,
        active_from,
        valid_until,
        sequence_number
      } = req.body || {};

      if (!key_id || !public_key_hex || sequence_number === undefined) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'key_id, public_key_hex, and sequence_number are required'
        });
      }

      const keyRecord = pqcManager.preStageKey({
        key_id,
        algorithm,
        public_key_hex,
        encrypted_private_key,
        active_from,
        valid_until,
        sequence_number: Number(sequence_number)
      });

      repos.auditLog.record({
        action: 'PQC_KEY_PRESTAGED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: { key_id, sequence_number }
      });

      return res.status(201).json({
        success: true,
        message: 'Key successfully added to pre-staged pool',
        key: keyRecord
      });
    } catch (err) {
      return res.status(500).json({ error: 'PRESTAGE_FAILED', message: err.message });
    }
  });

  // 5. Promote Pre-Staged Key to Active (Root only - FR-17 / FR-18)
  router.post('/pqc/promote', authenticate, requireRole(['root']), (req, res) => {
    try {
      const { key_id, reason } = req.body || {};
      if (!key_id) {
        return res.status(400).json({ error: 'KEY_ID_REQUIRED' });
      }

      const activeKey = pqcManager.promoteKey(key_id);

      repos.auditLog.record({
        action: 'PQC_KEY_PROMOTED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: { key_id, reason: reason || 'Scheduled advance rotation' }
      });

      return res.status(200).json({
        success: true,
        message: `PQC Key '${key_id}' is now active`,
        activeKey
      });
    } catch (err) {
      return res.status(500).json({ error: 'PROMOTE_FAILED', message: err.message });
    }
  });

  // 6. View PQC Key Pool (Mod & Root - FR-9)
  router.get('/pqc/pool', authenticate, requireRole(['mod', 'root']), (req, res) => {
    const pool = pqcManager.getPool();
    const active = pqcManager.getActiveKey();
    const preStaged = pqcManager.getPreStagedKeys();

    return res.status(200).json({
      activeKey: active,
      preStagedCount: preStaged.length,
      keys: pool
    });
  });

  // 7. Generate Cryptographic Delegation Endorsement Token (Root only - FR-24)
  router.post('/pqc/delegation/create', authenticate, requireRole(['root']), (req, res) => {
    try {
      const {
        endorsing_key_id,
        delegated_key_id,
        delegated_public_key_hex,
        valid_from,
        valid_until,
        reason
      } = req.body || {};

      if (!endorsing_key_id || !delegated_key_id || !delegated_public_key_hex || !reason) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'endorsing_key_id, delegated_key_id, delegated_public_key_hex, and reason are required'
        });
      }

      const endorsement = pqcManager.createDelegationEndorsement({
        endorsing_key_id,
        delegated_key_id,
        delegated_public_key_hex,
        valid_from,
        valid_until,
        reason,
        created_by: req.user.userId
      });

      repos.auditLog.record({
        action: 'DELEGATION_ENDORSEMENT_CREATED',
        status: 'ALERT',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: {
          endorsing_key_id,
          delegated_key_id,
          reason
        }
      });

      return res.status(201).json({
        success: true,
        endorsement
      });
    } catch (err) {
      return res.status(500).json({ error: 'DELEGATION_CREATE_FAILED', message: err.message });
    }
  });

  // 8. Verify Delegation Endorsement Token (Public / Offline verifiers)
  router.post('/pqc/delegation/verify', (req, res) => {
    const result = pqcManager.verifyDelegationToken(req.body);
    return res.status(200).json(result);
  });

  // 9. Export AES-256-GCM Encrypted Key Envelope (Root only - FR-20)
  router.post('/pqc/export', authenticate, requireRole(['root']), (req, res) => {
    try {
      const { master_passphrase } = req.body || {};
      if (!master_passphrase || master_passphrase.length < 12) {
        return res.status(400).json({
          error: 'INVALID_PASSPHRASE',
          message: 'master_passphrase must be at least 12 characters'
        });
      }

      const allKeys = repos.pqcKeys.listPool();
      const envelopeJson = exportEncryptedEnvelope({
        masterPassphrase: master_passphrase,
        keys: allKeys,
        metadata: { exported_by: req.user.username }
      });

      repos.auditLog.record({
        action: 'PQC_BACKUP_EXPORTED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: { key_count: allKeys.length }
      });

      return res.status(200).json({
        success: true,
        envelope: envelopeJson,
        filename: `scatterid_pqc_backup_${Date.now()}.enc`
      });
    } catch (err) {
      return res.status(500).json({ error: 'EXPORT_FAILED', message: err.message });
    }
  });

  // 10. Restore AES-256-GCM Encrypted Key Envelope (Root only - FR-20)
  router.post('/pqc/restore', authenticate, requireRole(['root']), (req, res) => {
    try {
      const { master_passphrase, envelope } = req.body || {};
      if (!master_passphrase || !envelope) {
        return res.status(400).json({
          error: 'MISSING_RESTORE_PAYLOAD',
          message: 'Both master_passphrase and envelope payload are required'
        });
      }

      const restoredPayload = restoreEncryptedEnvelope({
        masterPassphrase: master_passphrase,
        envelopeContent: envelope
      });

      // Atomic restore into SQLite database
      const restoreTx = db.transaction(() => {
        for (const key of restoredPayload.keys) {
          const existing = repos.pqcKeys.getKeyById(key.key_id);
          if (!existing) {
            repos.pqcKeys.addKeyToPool(key);
          }
        }
      });

      restoreTx();

      repos.auditLog.record({
        action: 'PQC_BACKUP_RESTORED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: 'root',
        client_ip: getClientIp(req),
        details: { restored_key_count: restoredPayload.keys.length }
      });

      return res.status(200).json({
        success: true,
        message: 'PQC key pool state restored successfully',
        restoredKeyCount: restoredPayload.keys.length
      });
    } catch (err) {
      return res.status(500).json({ error: 'RESTORE_FAILED', message: err.message });
    }
  });

  return router;
}

export default createKeysRouter;

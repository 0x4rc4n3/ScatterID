// Authentication & MFA API Routes
// Enforces Argon2id, RFC 6238 TOTP, Self-Service Phone Migration, and Single-Use Recovery Codes

import express from 'express';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  getTotpUri,
  generateQrDataUrl,
  encryptTotpSecret,
  decryptTotpSecret
} from '../auth/totp.js';
import {
  generateRecoveryCodesBatch,
  hashRecoveryCode,
  hashRecoveryCodeLegacy
} from '../auth/recoveryCodes.js';
import { signToken } from '../auth/tokens.js';
import { authenticate, requireRole, getClientIp } from '../auth/middleware.js';
import { defaultRateLimiter } from '../auth/rateLimiter.js';

export function createAuthRouter({ db, repos, rateLimiter = defaultRateLimiter }) {
  const router = express.Router();

  /**
   * POST /api/auth/login
   * Public login route supporting Password + TOTP or Recovery Code.
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, password, totp_code, recovery_code } = req.body || {};
      const clientIp = getClientIp(req);

      // Defend against IP-level distributed stuffing or grinding
      const ipCheck = rateLimiter.isIpRateLimited(clientIp);
      if (ipCheck.limited) {
        res.set('Retry-After', String(ipCheck.retryAfterSec));
        return res.status(429).json({
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many failed login requests from this IP address. Please try again later.',
          retryAfter: ipCheck.retryAfterSec
        });
      }

      // Defend against account-level brute-force attacks
      if (username) {
        const accountCheck = rateLimiter.isAccountLocked(username);
        if (accountCheck.locked) {
          res.set('Retry-After', String(accountCheck.retryAfterSec));
          return res.status(423).json({
            error: 'ACCOUNT_LOCKED',
            message: `Account '${username}' is temporarily locked due to excessive failed login attempts. Please try again in ${accountCheck.retryAfterSec} seconds.`,
            retryAfter: accountCheck.retryAfterSec
          });
        }
      }

      if (!username || !password) {
        return res.status(400).json({
          error: 'MISSING_CREDENTIALS',
          message: 'Both username and password are required'
        });
      }

      const user = repos.users.findByUsername(username);
      if (!user) {
        const failResult = rateLimiter.recordFailedAttempt(username, clientIp);
        if (failResult.accountLocked) {
          repos.auditLog.record({
            action: 'USER_ACCOUNT_LOCKED',
            status: 'ALERT',
            username,
            client_ip: clientIp,
            details: { reason: 'Exceeded maximum failed login attempts', attempts: failResult.attempts, retryAfterSec: failResult.retryAfterSec }
          });
        }
        repos.auditLog.record({
          action: 'USER_LOGIN_FAILED',
          status: 'DENIED',
          username,
          client_ip: clientIp,
          details: { reason: 'User not found' }
        });
        if (failResult.accountLocked) {
          res.set('Retry-After', String(failResult.retryAfterSec));
          return res.status(423).json({
            error: 'ACCOUNT_LOCKED',
            message: `Account '${username}' is temporarily locked due to excessive failed login attempts. Please try again in ${failResult.retryAfterSec} seconds.`,
            retryAfter: failResult.retryAfterSec
          });
        }
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        });
      }

      // Step 1: Verify Password with Argon2id
      const passwordValid = await verifyPassword(user.password_hash, password);
      if (!passwordValid) {
        const failResult = rateLimiter.recordFailedAttempt(user.username, clientIp);
        if (failResult.accountLocked) {
          repos.auditLog.record({
            action: 'USER_ACCOUNT_LOCKED',
            status: 'ALERT',
            actor_id: user.id,
            username: user.username,
            role: user.role,
            client_ip: clientIp,
            details: { reason: 'Exceeded maximum failed login attempts (password mismatch)', attempts: failResult.attempts, retryAfterSec: failResult.retryAfterSec }
          });
        }
        repos.auditLog.record({
          action: 'USER_LOGIN_FAILED',
          status: 'DENIED',
          actor_id: user.id,
          username: user.username,
          role: user.role,
          client_ip: clientIp,
          details: { reason: 'Password mismatch' }
        });
        if (failResult.accountLocked) {
          res.set('Retry-After', String(failResult.retryAfterSec));
          return res.status(423).json({
            error: 'ACCOUNT_LOCKED',
            message: `Account '${user.username}' is temporarily locked due to excessive failed login attempts. Please try again in ${failResult.retryAfterSec} seconds.`,
            retryAfter: failResult.retryAfterSec
          });
        }
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        });
      }

      // Step 2: Role-based MFA Check & First-Time Setup
      const isMfaMandatoryRole = user.role === 'mod' || user.role === 'root';

      if (user.force_password_reset || (isMfaMandatoryRole && !user.totp_enabled)) {
        // Must complete onboarding/MFA setup before standard access is granted
        const tempToken = signToken({
          userId: user.id,
          username: user.username,
          role: user.role,
          stationId: user.station_id,
          mfaPending: true
        }, 1800); // 30 minutes to complete setup

        const secret = generateTotpSecret();
        const otpauthUri = getTotpUri(secret, user.username);
        const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);
        const recoveryCodes = generateRecoveryCodesBatch(8);
        const mfaSetup = {
          secret,
          otpauthUri,
          qrCodeDataUrl,
          recoveryCodes
        };

        return res.status(200).json({
          requireFirstTimeSetup: true,
          requireMfaEnrollment: isMfaMandatoryRole || Boolean(user.force_password_reset),
          forcePasswordReset: Boolean(user.force_password_reset),
          tempToken,
          username: user.username,
          role: user.role,
          mfaSetup,
          message: 'First-time setup required. Configure your permanent password and MFA credentials.'
        });
      }

      let mfaMethod = 'none';

      if (user.totp_enabled) {
        if (!totp_code && !recovery_code) {
          return res.status(401).json({
            error: 'MFA_REQUIRED',
            message: 'TOTP 6-digit code or single-use recovery code is required',
            mfaRequired: true
          });
        }

        let mfaVerified = false;

        // Try TOTP code first
        if (totp_code) {
          const plainSecret = decryptTotpSecret(user.totp_secret);
          if (verifyTotpCode(plainSecret, totp_code)) {
            mfaVerified = true;
            mfaMethod = 'totp';
          }
        }

        // Try Recovery Code if TOTP failed or not provided
        if (!mfaVerified && recovery_code) {
          const codeHash = hashRecoveryCode(recovery_code);
          let codeValid = repos.recoveryCodes.verifyAndConsumeCode(user.id, codeHash);
          if (!codeValid) {
            // Backward-compatible fallback for legacy unkeyed SHA-256 hashes
            const legacyHash = hashRecoveryCodeLegacy(recovery_code);
            codeValid = repos.recoveryCodes.verifyAndConsumeCode(user.id, legacyHash);
          }
          if (codeValid) {
            mfaVerified = true;
            mfaMethod = 'recovery_code';
            const remaining = repos.recoveryCodes.getRemainingCount(user.id);
            repos.auditLog.record({
              action: 'RECOVERY_CODE_CONSUMED',
              status: 'ALERT',
              actor_id: user.id,
              username: user.username,
              role: user.role,
              client_ip: clientIp,
              details: { remainingCodes: remaining }
            });
          }
        }

        if (!mfaVerified) {
          const failResult = rateLimiter.recordFailedAttempt(user.username, clientIp);
          if (failResult.accountLocked) {
            repos.auditLog.record({
              action: 'USER_ACCOUNT_LOCKED',
              status: 'ALERT',
              actor_id: user.id,
              username: user.username,
              role: user.role,
              client_ip: clientIp,
              details: { reason: 'Exceeded maximum failed login attempts (MFA validation failed)', attempts: failResult.attempts, retryAfterSec: failResult.retryAfterSec }
            });
          }
          repos.auditLog.record({
            action: 'MFA_VALIDATION_FAILED',
            status: 'DENIED',
            actor_id: user.id,
            username: user.username,
            role: user.role,
            client_ip: clientIp,
            details: { reason: 'Invalid TOTP or recovery code' }
          });
          if (failResult.accountLocked) {
            res.set('Retry-After', String(failResult.retryAfterSec));
            return res.status(423).json({
              error: 'ACCOUNT_LOCKED',
              message: `Account '${user.username}' is temporarily locked due to excessive failed login attempts. Please try again in ${failResult.retryAfterSec} seconds.`,
              retryAfter: failResult.retryAfterSec
            });
          }
          return res.status(401).json({
            error: 'INVALID_MFA_TOKEN',
            message: 'Invalid TOTP code or recovery code'
          });
        }
      }

      // Step 3: Issue Session Token
      rateLimiter.recordSuccess(user.username, clientIp);
      const token = signToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        stationId: user.station_id
      });

      repos.auditLog.record({
        action: 'USER_LOGIN_SUCCESS',
        status: 'SUCCESS',
        actor_id: user.id,
        username: user.username,
        role: user.role,
        station_id: user.station_id,
        client_ip: clientIp,
        details: { mfaMethod }
      });

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          station_id: user.station_id,
          totp_enabled: Boolean(user.totp_enabled),
          force_password_reset: Boolean(user.force_password_reset)
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * POST /api/auth/mfa/enroll
   * Initiates MFA setup by generating a new secret, QR code, and 8 recovery codes.
   */
  router.post('/mfa/enroll', authenticate, async (req, res) => {
    try {
      const user = repos.users.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      const secret = generateTotpSecret();
      const otpauthUri = getTotpUri(secret, user.username);
      const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);
      const recoveryCodes = generateRecoveryCodesBatch(8);

      return res.status(200).json({
        secret,
        otpauthUri,
        qrCodeDataUrl,
        recoveryCodes
      });
    } catch (err) {
      return res.status(500).json({ error: 'MFA_ENROLL_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/mfa/enroll/confirm
   * Confirms MFA enrollment with a 6-digit code.
   */
  router.post('/mfa/enroll/confirm', authenticate, async (req, res) => {
    try {
      const { secret, code, recoveryCodes } = req.body || {};
      const clientIp = getClientIp(req);

      if (!secret || !code) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Secret and verification code are required' });
      }

      const isValid = verifyTotpCode(secret, code);
      if (!isValid) {
        return res.status(400).json({ error: 'INVALID_TOTP_CODE', message: 'Verification code is invalid or expired' });
      }

      const encryptedSecret = encryptTotpSecret(secret);

      // Save encrypted secret and recovery codes atomically
      const enrollTx = db.transaction(() => {
        repos.users.updateTotp(req.user.userId, {
          totp_secret: encryptedSecret,
          totp_enabled: 1
        });

        if (Array.isArray(recoveryCodes) && recoveryCodes.length > 0) {
          const hashes = recoveryCodes.map(hashRecoveryCode);
          repos.recoveryCodes.saveCodesForUser(req.user.userId, hashes);
        }
      });

      enrollTx();

      repos.auditLog.record({
        action: 'MFA_ENROLLMENT_COMPLETED',
        status: 'SUCCESS',
        actor_id: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        client_ip: clientIp
      });

      // Issue full token with active privileges
      const token = signToken({
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        stationId: req.user.stationId
      });

      return res.status(200).json({
        success: true,
        message: 'MFA enrollment confirmed successfully',
        token
      });
    } catch (err) {
      return res.status(500).json({ error: 'CONFIRM_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/mfa/transfer/init
   * Step 1 of Self-Service Phone Migration: Re-authenticates with password and generates new enrollment QR.
   */
  router.post('/mfa/transfer/init', authenticate, async (req, res) => {
    try {
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ error: 'PASSWORD_REQUIRED', message: 'Current password is required to transfer MFA device' });
      }

      const user = repos.users.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      const passwordValid = await verifyPassword(user.password_hash, password);
      if (!passwordValid) {
        repos.auditLog.record({
          action: 'MFA_TRANSFER_AUTH_FAILED',
          status: 'DENIED',
          actor_id: user.id,
          username: user.username,
          role: user.role,
          client_ip: getClientIp(req),
          details: { reason: 'Incorrect password during MFA transfer init' }
        });
        return res.status(401).json({ error: 'INVALID_PASSWORD', message: 'Current password verification failed' });
      }

      const newSecret = generateTotpSecret();
      const otpauthUri = getTotpUri(newSecret, user.username);
      const qrCodeDataUrl = await generateQrDataUrl(otpauthUri);

      return res.status(200).json({
        success: true,
        newSecret,
        otpauthUri,
        qrCodeDataUrl
      });
    } catch (err) {
      return res.status(500).json({ error: 'TRANSFER_INIT_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/mfa/transfer/confirm
   * Step 2 of Self-Service Phone Migration: Validates code from new phone, replaces secret,
   * invalidates old device token, and mints 8 fresh single-use recovery codes.
   */
  router.post('/mfa/transfer/confirm', authenticate, async (req, res) => {
    try {
      const { password, newSecret, newTotpCode } = req.body || {};
      const clientIp = getClientIp(req);

      if (!password || !newSecret || !newTotpCode) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Current password, new secret, and new TOTP code are required'
        });
      }

      const user = repos.users.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      // Re-verify password
      const passwordValid = await verifyPassword(user.password_hash, password);
      if (!passwordValid) {
        return res.status(401).json({ error: 'INVALID_PASSWORD', message: 'Current password verification failed' });
      }

      // Verify code from new phone
      const codeValid = verifyTotpCode(newSecret, newTotpCode);
      if (!codeValid) {
        return res.status(400).json({
          error: 'INVALID_NEW_TOTP_CODE',
          message: '6-digit verification code from new phone is invalid or expired'
        });
      }

      // Generate 8 fresh single-use recovery codes
      const freshRecoveryCodes = generateRecoveryCodesBatch(8);
      const recoveryHashes = freshRecoveryCodes.map(hashRecoveryCode);
      const encryptedSecret = encryptTotpSecret(newSecret);

      // Atomic cutover: replace secret, invalidate old recovery codes, save new ones
      const transferTx = db.transaction(() => {
        repos.users.updateTotp(user.id, {
          totp_secret: encryptedSecret,
          totp_enabled: 1
        });
        repos.recoveryCodes.saveCodesForUser(user.id, recoveryHashes);
      });

      transferTx();

      repos.auditLog.record({
        action: 'MFA_DEVICE_TRANSFERRED',
        status: 'SUCCESS',
        actor_id: user.id,
        username: user.username,
        role: user.role,
        client_ip: clientIp,
        details: { message: 'New MFA device enrolled, old device revoked, 8 new recovery codes minted' }
      });

      return res.status(200).json({
        success: true,
        message: 'MFA device transferred successfully. Old device token is revoked.',
        recoveryCodes: freshRecoveryCodes
      });
    } catch (err) {
      return res.status(500).json({ error: 'TRANSFER_CONFIRM_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/reset-password
   * Allows users to change their own password, or Mod/Root to reset subordinate passwords.
   */
  router.post('/reset-password', authenticate, async (req, res) => {
    try {
      const { targetUserId, currentPassword, newPassword, resetMfa } = req.body || {};
      const clientIp = getClientIp(req);

      if (!newPassword || newPassword.length < 10) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'New password must be at least 10 characters long'
        });
      }

      const caller = repos.users.findById(req.user.userId);
      const targetId = targetUserId || req.user.userId;
      const targetUser = repos.users.findById(targetId);

      if (!targetUser) {
        return res.status(404).json({ error: 'TARGET_USER_NOT_FOUND' });
      }

      // Authorization matrix for password resets
      const isSelf = caller.id === targetUser.id;
      const isModResettingClerk = caller.role === 'mod' && targetUser.role === 'clerk';
      const isRootResettingAny = caller.role === 'root';

      if (!isSelf && !isModResettingClerk && !isRootResettingAny) {
        repos.auditLog.record({
          action: 'PASSWORD_RESET_DENIED',
          status: 'DENIED',
          actor_id: caller.id,
          username: caller.username,
          role: caller.role,
          client_ip: clientIp,
          details: { targetUserId: targetUser.id, targetRole: targetUser.role }
        });
        return res.status(403).json({
          error: 'INSUFFICIENT_PRIVILEGES',
          message: `Role '${caller.role}' is not authorized to reset password for role '${targetUser.role}'`
        });
      }

      // If self-reset, current password is mandatory
      if (isSelf) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'CURRENT_PASSWORD_REQUIRED' });
        }
        const valid = await verifyPassword(targetUser.password_hash, currentPassword);
        if (!valid) {
          return res.status(401).json({ error: 'INVALID_CURRENT_PASSWORD' });
        }
      }

      // Hash new password with Argon2id
      const newHash = await hashPassword(newPassword);
      const forceChangeOnNextLogin = !isSelf ? 1 : 0;

      const resetTx = db.transaction(() => {
        repos.users.updatePassword(targetUser.id, newHash, forceChangeOnNextLogin);

        if (resetMfa && (isRootResettingAny || isModResettingClerk)) {
          repos.users.updateTotp(targetUser.id, { totp_secret: null, totp_enabled: 0 });
          db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(targetUser.id);
        }
      });

      resetTx();

      repos.auditLog.record({
        action: 'PASSWORD_RESET_SUCCESS',
        status: 'SUCCESS',
        actor_id: caller.id,
        username: caller.username,
        role: caller.role,
        client_ip: clientIp,
        details: { targetUserId: targetUser.id, mfaReset: Boolean(resetMfa) }
      });

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (err) {
      return res.status(500).json({ error: 'RESET_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/first-time-setup
   * Completes account onboarding for newly provisioned users with temporary OTPs.
   * Atomically updates permanent password, sets up TOTP MFA, and issues operational session token.
   */
  router.post('/first-time-setup', authenticate, async (req, res) => {
    try {
      const { newPassword, totpCode, totpSecret, recoveryCodes } = req.body || {};
      const clientIp = getClientIp(req);
      const user = repos.users.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      if (!newPassword || newPassword.length < 10) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Permanent password must be at least 10 characters long'
        });
      }

      const isMfaMandatory = user.role === 'mod' || user.role === 'root';
      const cleanTotpCode = typeof totpCode === 'string' ? totpCode.replace(/\s+/g, '').replace(/-/g, '').trim() : '';
      let secretToVerify = totpSecret;
      if (!secretToVerify && user.totp_secret) {
        try { secretToVerify = decryptTotpSecret(user.totp_secret); } catch(e) {}
      }

      const hasMfaInputs = Boolean(secretToVerify && cleanTotpCode);
      const shouldConfigureMfa = isMfaMandatory || hasMfaInputs;
      let encryptedSecret = user.totp_secret;
      let totpEnabled = user.totp_enabled;

      if (shouldConfigureMfa) {
        if (!secretToVerify || !cleanTotpCode) {
          return res.status(400).json({
            error: 'MFA_VERIFICATION_REQUIRED',
            message: 'Both TOTP secret and 6-digit verification code are required'
          });
        }
        const isValid = verifyTotpCode(secretToVerify, cleanTotpCode, 2);
        if (!isValid) {
          return res.status(400).json({
            error: 'INVALID_TOTP_CODE',
            message: 'The 6-digit TOTP code is invalid or expired. Please check your authenticator app.'
          });
        }
        encryptedSecret = encryptTotpSecret(secretToVerify);
        totpEnabled = 1;
      }

      const newPasswordHash = await hashPassword(newPassword);

      const setupTx = db.transaction(() => {
        repos.users.updatePassword(user.id, newPasswordHash, 0);
        if (shouldConfigureMfa) {
          repos.users.updateTotp(user.id, {
            totp_secret: encryptedSecret,
            totp_enabled: 1
          });
          if (Array.isArray(recoveryCodes) && recoveryCodes.length > 0) {
            const hashes = recoveryCodes.map(hashRecoveryCode);
            repos.recoveryCodes.saveCodesForUser(user.id, hashes);
          }
        }
      });
      setupTx();

      repos.auditLog.record({
        action: 'USER_FIRST_TIME_SETUP_COMPLETE',
        status: 'SUCCESS',
        actor_id: user.id,
        username: user.username,
        role: user.role,
        client_ip: clientIp,
        details: { mfaEnabled: Boolean(totpEnabled) }
      });

      const token = signToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        stationId: user.station_id
      });

      return res.status(200).json({
        success: true,
        message: 'Account onboarding completed successfully.',
        token,
        recoveryCodes: Array.isArray(recoveryCodes) ? recoveryCodes : [],
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          station_id: user.station_id,
          totp_enabled: Boolean(totpEnabled)
        }
      });
    } catch (err) {
      return res.status(500).json({ error: 'SETUP_FAILED', message: err.message });
    }
  });

  /**
   * POST /api/auth/unlock
   * Allows privileged users (root, mod) to unlock a locked account.
   */
  router.post('/unlock', authenticate, requireRole(['root', 'mod']), (req, res) => {
    const { target_username } = req.body || {};
    if (!target_username) {
      return res.status(400).json({ error: 'MISSING_USERNAME', message: 'Target username is required' });
    }
    const unlocked = rateLimiter.unlockAccount(target_username);
    repos.auditLog.record({
      action: 'USER_ACCOUNT_UNLOCKED',
      status: 'SUCCESS',
      actor_id: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      details: { target_username, was_locked: unlocked }
    });
    return res.status(200).json({
      success: true,
      message: `Account '${target_username}' unlocked successfully`,
      wasLocked: unlocked
    });
  });

  /**
   * GET /api/auth/me
   * Returns current authenticated user context.
   */
  router.get('/me', authenticate, (req, res) => {
    const user = repos.users.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        station_id: user.station_id,
        totp_enabled: Boolean(user.totp_enabled),
        force_password_reset: Boolean(user.force_password_reset),
        created_at: user.created_at
      }
    });
  });

  return router;
}

export default createAuthRouter;

// Login Rate Limiting & Account Lockout Module
// Defends against credential stuffing, brute-force dictionary attacks, and MFA grinding

export class AuthRateLimiter {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || parseInt(process.env.AUTH_MAX_ATTEMPTS || '5', 10);
    this.lockoutDurationMs = options.lockoutDurationMs || parseInt(process.env.AUTH_LOCKOUT_DURATION_MS || '900000', 10); // 15 mins
    this.ipMaxAttempts = options.ipMaxAttempts || parseInt(process.env.AUTH_IP_MAX_ATTEMPTS || '25', 10); // 25 attempts per IP window
    this.ipWindowMs = options.ipWindowMs || parseInt(process.env.AUTH_IP_WINDOW_MS || '900000', 10); // 15 mins window

    // In-memory tracking maps
    this.accountAttempts = new Map(); // username -> { count, lockedUntil, lastAttempt, lockoutMultiplier }
    this.ipAttempts = new Map();      // ip -> { count, lockedUntil, resetAt }
  }

  _normalizeUsername(username) {
    return (username || '').trim().toLowerCase();
  }

  isAccountLocked(rawUsername) {
    const username = this._normalizeUsername(rawUsername);
    if (!username) return { locked: false, remainingMs: 0, retryAfterSec: 0, attempts: 0 };

    const record = this.accountAttempts.get(username);
    if (!record) return { locked: false, remainingMs: 0, retryAfterSec: 0, attempts: 0 };

    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingMs = record.lockedUntil - now;
      const retryAfterSec = Math.ceil(remainingMs / 1000);
      return {
        locked: true,
        remainingMs,
        retryAfterSec,
        attempts: record.count
      };
    }

    // Lockout expired: reset attempts
    if (record.lockedUntil && record.lockedUntil <= now) {
      record.lockedUntil = null;
      record.count = 0;
    }

    return { locked: false, remainingMs: 0, retryAfterSec: 0, attempts: record.count };
  }

  isIpRateLimited(ip) {
    const cleanIp = (ip || 'unknown').trim();
    const record = this.ipAttempts.get(cleanIp);
    if (!record) return { limited: false, remainingMs: 0, retryAfterSec: 0, count: 0 };

    const now = Date.now();
    // Check if IP is under hard lockout
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingMs = record.lockedUntil - now;
      const retryAfterSec = Math.ceil(remainingMs / 1000);
      return {
        limited: true,
        remainingMs,
        retryAfterSec,
        count: record.count
      };
    }

    // Check if current sliding window has expired
    if (record.resetAt && record.resetAt <= now) {
      record.count = 0;
      record.resetAt = now + this.ipWindowMs;
      record.lockedUntil = null;
      return { limited: false, remainingMs: 0, retryAfterSec: 0, count: 0 };
    }

    if (record.count >= this.ipMaxAttempts) {
      const remainingMs = Math.max(0, (record.resetAt || now) - now);
      const retryAfterSec = Math.ceil(remainingMs / 1000);
      return {
        limited: true,
        remainingMs,
        retryAfterSec,
        count: record.count
      };
    }

    return { limited: false, remainingMs: 0, retryAfterSec: 0, count: record.count };
  }

  recordFailedAttempt(rawUsername, ip) {
    const username = this._normalizeUsername(rawUsername);
    const cleanIp = (ip || 'unknown').trim();
    const now = Date.now();

    // 1. Track IP attempts
    let ipRecord = this.ipAttempts.get(cleanIp);
    if (!ipRecord || (ipRecord.resetAt && ipRecord.resetAt <= now)) {
      ipRecord = { count: 0, lockedUntil: null, resetAt: now + this.ipWindowMs };
      this.ipAttempts.set(cleanIp, ipRecord);
    }
    ipRecord.count += 1;
    let ipLimited = false;
    let ipRetryAfterSec = 0;
    if (ipRecord.count >= this.ipMaxAttempts) {
      ipRecord.lockedUntil = now + this.lockoutDurationMs;
      ipLimited = true;
      ipRetryAfterSec = Math.ceil(this.lockoutDurationMs / 1000);
    }

    // 2. Track Account attempts
    let accountLocked = false;
    let lockedUntil = null;
    let retryAfterSec = 0;
    let attempts = 1;

    if (username) {
      let accRecord = this.accountAttempts.get(username);
      if (!accRecord) {
        accRecord = { count: 0, lockedUntil: null, lastAttempt: now, lockoutMultiplier: 1 };
        this.accountAttempts.set(username, accRecord);
      }

      accRecord.count += 1;
      accRecord.lastAttempt = now;
      attempts = accRecord.count;

      if (accRecord.count >= this.maxAttempts) {
        // Progressive exponential backoff multiplier (capped at 4x = 1 hour max)
        const multiplier = accRecord.lockoutMultiplier || 1;
        const duration = this.lockoutDurationMs * multiplier;
        accRecord.lockedUntil = now + duration;
        accRecord.lockoutMultiplier = Math.min(4, multiplier * 2);
        accountLocked = true;
        lockedUntil = accRecord.lockedUntil;
        retryAfterSec = Math.ceil(duration / 1000);
      }
    }

    return {
      accountLocked,
      ipLimited,
      attempts,
      lockedUntil,
      retryAfterSec: accountLocked ? retryAfterSec : ipRetryAfterSec
    };
  }

  recordSuccess(rawUsername, ip) {
    const username = this._normalizeUsername(rawUsername);
    const cleanIp = (ip || 'unknown').trim();

    if (username) {
      this.accountAttempts.delete(username);
    }

    const ipRecord = this.ipAttempts.get(cleanIp);
    if (ipRecord) {
      // Reduce IP failure count upon successful authentication
      ipRecord.count = Math.max(0, ipRecord.count - 1);
    }
  }

  unlockAccount(rawUsername) {
    const username = this._normalizeUsername(rawUsername);
    if (username && this.accountAttempts.has(username)) {
      this.accountAttempts.delete(username);
      return true;
    }
    return false;
  }

  reset() {
    this.accountAttempts.clear();
    this.ipAttempts.clear();
  }
}

// Export singleton instance as default
export const defaultRateLimiter = new AuthRateLimiter();

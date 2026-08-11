import { createHash } from 'crypto';
import { getTenantByKey } from '../db/keys.js';
import { redisClient, isRedisConnected } from '../redis.js';

// Rate limit configurations per tier
const LIMITS = {
  standard: { limit: 10, window: 10 }, // 10 requests per 10 seconds
  enterprise: { limit: 100, window: 10 }, // 100 requests per 10 seconds
};

// Lua Script for sliding window rate limiting
const rateLimitScript = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  redis.call('zremrangebyscore', key, 0, now - window)
  local current = redis.call('zcard', key)
  if current < limit then
    redis.call('zadd', key, now, now)
    redis.call('expire', key, window)
    return 1
  else
    return 0
  end
`;

export async function authenticateApiKey(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized: Missing or malformed Authorization header',
        code: 'UNAUTHORIZED'
      });
    }

    const apiKey = authHeader.substring(7).trim();
    if (apiKey === '') {
      return res.status(401).json({
        error: 'Unauthorized: Empty API key provided',
        code: 'UNAUTHORIZED'
      });
    }

    const hashedToken = createHash('sha256').update(apiKey).digest('hex');
    const cacheKey = `api_key:${hashedToken}`;

    let tenantProfile = null;

    // 1. Check Redis Cache
    if (isRedisConnected()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          tenantProfile = JSON.parse(cached);
        }
      } catch (cacheErr) {
        console.warn('Redis read failed, bypassing cache:', cacheErr.message);
      }
    }

    // 2. Fallback to SQLite Database Lookup
    if (!tenantProfile) {
      tenantProfile = getTenantByKey(apiKey);
      if (!tenantProfile) {
        return res.status(401).json({
          error: 'Unauthorized: Invalid API key',
          code: 'UNAUTHORIZED'
        });
      }

      // Cache the result in Redis with 5-minute TTL
      if (isRedisConnected()) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(tenantProfile), {
            EX: 300
          });
        } catch (cacheErr) {
          console.warn('Redis write failed:', cacheErr.message);
        }
      }
    }

    // 3. Quota Enforcement
    if (tenantProfile.quota_used >= tenantProfile.quota_limit) {
      return res.status(403).json({
        error: 'Forbidden: Usage quota exceeded. Please upgrade your plan.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    // 4. Sliding Window Rate Limiting (Redis-backed)
    if (isRedisConnected()) {
      try {
        const now = Date.now() / 1000;
        const config = LIMITS[tenantProfile.tier] || LIMITS.standard;
        const rateLimitKey = `rate_limit:${tenantProfile.tenant_id}`;

        const allowed = await redisClient.eval(rateLimitScript, {
          keys: [rateLimitKey],
          arguments: [now.toString(), config.window.toString(), config.limit.toString()]
        });

        if (Number(allowed) !== 1) {
          return res.status(429).json({
            error: 'Too Many Requests: Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
          });
        }
      } catch (redisErr) {
        console.warn('Redis rate limiting evaluation failed, bypassing:', redisErr.message);
      }
    }

    // Expose context parameters to req object
    req.tenantId = tenantProfile.tenant_id;
    req.tenantTier = tenantProfile.tier;
    req.apiKey = apiKey;
    
    next();
  } catch (err) {
    console.error('Authentication Middleware Uncaught Error:', err.stack || err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    });
  }
}

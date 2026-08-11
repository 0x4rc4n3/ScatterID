import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
export const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  // Suppress spammy log outputs if redis goes offline during restart
});

let redisConnected = false;

export async function connectRedis() {
  if (redisConnected) return;
  try {
    await redisClient.connect();
    redisConnected = true;
    console.log('[+] Redis connection established in shared client.');
  } catch (err) {
    console.error('[-] Failed to connect to Redis in shared client:', err.message);
  }
}

export function isRedisConnected() {
  return redisConnected;
}

export async function publishBillingEvent(tenantId, action) {
  if (!redisConnected) return;
  try {
    await redisClient.xAdd('verification_events', '*', {
      tenantId: tenantId || 'default-tenant',
      action: action || 'unknown',
      timestamp: Date.now().toString()
    });
  } catch (err) {
    console.error('Failed to publish billing event to Redis Stream:', err.message);
  }
}

import { createClient } from 'redis';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const keysDbPath = path.join(DATA_DIR, 'gateway_system.db');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(keysDbPath);
const updateQuotaStmt = db.prepare(`
  UPDATE api_keys SET quota_used = quota_used + 1 WHERE tenant_id = ?
`);

function updateQuotaUsed(tenantId) {
  try {
    updateQuotaStmt.run(tenantId);
    console.log(`[Aggregator] Incremented quota_used for tenant: ${tenantId}`);
  } catch (err) {
    console.error(`[-] Failed to update quota for tenant ${tenantId}:`, err.message);
  }
}

const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error in aggregator:', err));

let running = true;

async function startAggregator() {
  console.log('[+] Starting ScatterID Billing Aggregator Service...');
  try {
    await redisClient.connect();
    console.log('[+] Connected to Redis.');

    // Ensure Stream and Consumer Group exist
    try {
      await redisClient.xGroupCreate('verification_events', 'billing_group', '0', { MKSTREAM: true });
      console.log('[+] Created Redis Consumer Group: billing_group.');
    } catch (grpErr) {
      if (grpErr.message.includes('BUSYGROUP')) {
        console.log('[+] Redis Consumer Group: billing_group already active.');
      } else {
        throw grpErr;
      }
    }

    // Event Consumer Loop
    while (running) {
      try {
        const response = await redisClient.xReadGroup(
          'billing_group',
          'consumer_1',
          { key: 'verification_events', id: '>' },
          { COUNT: 10, BLOCK: 1000 }
        );

        if (response && response.length > 0) {
          for (const stream of response) {
            for (const message of stream.messages) {
              const { id, message: body } = message;
              const { tenantId, action } = body;

              if (tenantId) {
                updateQuotaUsed(tenantId);
              }

              // Acknowledge stream message
              await redisClient.xAck('verification_events', 'billing_group', id);
            }
          }
        }
      } catch (loopErr) {
        console.error('[-] Error in aggregator consumer loop:', loopErr.message);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  } catch (err) {
    console.error('CRITICAL: Aggregator startup failed:', err.message);
    process.exit(1);
  }
}

startAggregator();

process.on('SIGTERM', () => {
  console.log('[Aggregator] SIGTERM received. Shutting down consumer loop...');
  running = false;
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', () => {
  console.log('[Aggregator] SIGINT received. Shutting down consumer loop...');
  running = false;
  setTimeout(() => process.exit(0), 1000);
});

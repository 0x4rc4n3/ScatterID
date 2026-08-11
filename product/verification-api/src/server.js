import express from 'express';
import { getConfig } from './config.js';
if (getConfig('system.env') !== 'production' && process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[WARNING] TLS certificate validation is disabled (non-production environment fallback).');
}

import { createHash } from 'crypto';
import { issueRoute } from './routes/issue.js';
import { statusRoute } from './routes/status.js';
import { verifyRoute } from './routes/verify.js';
import { healShards, getAllCredentials } from './db/models.js';
import { authenticateApiKey } from './middleware/auth.js';
import { verifyHmacSignature } from './middleware/signature.js';
import { connectRedis, redisClient, isRedisConnected } from './redis.js';
import { rotateTenantKey } from './db/keys.js';

connectRedis();

const app = express();
app.use(express.json());

app.post('/issue', authenticateApiKey, verifyHmacSignature, issueRoute);
app.get('/status/:id', statusRoute);
app.post('/verify', authenticateApiKey, verifyHmacSignature, verifyRoute);

app.post('/rotate-key', authenticateApiKey, verifyHmacSignature, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const oldPlaintextKey = req.apiKey;

    const result = rotateTenantKey(tenantId);
    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to rotate key.' });
    }

    // Immediately evict old cache key from Redis
    if (oldPlaintextKey && isRedisConnected()) {
      const oldHashed = createHash('sha256').update(oldPlaintextKey).digest('hex');
      const cacheKey = `api_key:${oldHashed}`;
      await redisClient.del(cacheKey);
      console.log(`[Gateway] Evicted rotated API key from cache: ${cacheKey}`);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Failed to rotate key:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/credentials', authenticateApiKey, verifyHmacSignature, async (req, res) => {
  try {
    const tenantId = req.tenantId || 'default-tenant';
    const credentials = await getAllCredentials(tenantId);
    res.json({ success: true, credentials });
  } catch (err) {
    console.error('Failed to get credentials:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error', credentials: [] });
  }
});

app.post('/heal-shards', authenticateApiKey, verifyHmacSignature, async (req, res) => {
  try {
    const { nodeId } = req.body || {};
    const parsedNodeId = parseInt(nodeId, 10);
    if (isNaN(parsedNodeId) || parsedNodeId < 1 || parsedNodeId > 5) {
      return res.status(400).json({ success: false, error: 'Invalid parameter: nodeId must be an integer between 1 and 5' });
    }
    const tenantId = req.tenantId || 'default-tenant';
    const events = await healShards(parsedNodeId, tenantId);
    res.json({ success: true, events });
  } catch (err) {
    console.error('Failed to heal shards:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Verification API listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Verification API received SIGTERM, exiting...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Verification API received SIGINT, exiting...');
  process.exit(0);
});

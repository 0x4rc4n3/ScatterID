process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import { issueRoute } from './routes/issue.js';
import { statusRoute } from './routes/status.js';
import { verifyRoute } from './routes/verify.js';
import { healShards, getAllCredentials } from './db/models.js';

const app = express();
app.use(express.json());

app.post('/issue', issueRoute);
app.get('/status/:id', statusRoute);
app.post('/verify', verifyRoute);
app.get('/credentials', async (req, res) => {
  try {
    const credentials = await getAllCredentials();
    res.json({ success: true, credentials });
  } catch (err) {
    console.error('Failed to get credentials:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error', credentials: [] });
  }
});
app.post('/heal-shards', async (req, res) => {
  try {
    const { nodeId } = req.body || {};
    const parsedNodeId = parseInt(nodeId, 10);
    if (isNaN(parsedNodeId) || parsedNodeId < 1 || parsedNodeId > 5) {
      return res.status(400).json({ success: false, error: 'Invalid parameter: nodeId must be an integer between 1 and 5' });
    }
    const events = await healShards(parsedNodeId);
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

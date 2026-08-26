// TLS trust for crypto-service is established via NODE_EXTRA_CA_CERTS
// pointing to the ScatterID internal CA cert (ca.crt). Never disable
// certificate verification globally.
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { issueRoute } from './routes/issue.js';
import { statusRoute } from './routes/status.js';
import { verifyRoute } from './routes/verify.js';
import { getAllCredentials } from './db/models.js';

const app = express();
app.use(express.json());
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' }
});

app.use('/issue', apiLimiter);
app.use('/verify', apiLimiter);

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

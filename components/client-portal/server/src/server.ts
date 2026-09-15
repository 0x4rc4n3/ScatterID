// components/client-portal/server/src/server.ts
// ScatterID Counter-VPN Gateway & Proxy Server

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createClerkAuthHandler } from './auth/clerkAuth.js';
import { createIssueRouter } from './routes/issue.js';
import { createRevokeRouter } from './routes/revoke.js';
import { createTrackRouter } from './routes/track.js';
import { createVerifyRouter } from './routes/verify.js';
import { OpsDashboardClient } from './proxy/opsDashboardClient.js';
import { VerificationApiClient } from './proxy/verificationApiClient.js';

export interface ServerOptions {
  opsDashboardClient?: OpsDashboardClient;
  verificationApiClient?: VerificationApiClient;
}

export function createServer(options: ServerOptions = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // Health check endpoint
  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'scatterid-client-portal-server',
      timestamp: new Date().toISOString(),
    });
  });

  const opsClient = options.opsDashboardClient;
  const verifyClient = options.verificationApiClient;

  const authHandler = createClerkAuthHandler(opsClient);
  app.post('/auth/login', authHandler.login);
  app.get('/auth/me', authHandler.me);
  app.post('/auth/logout', authHandler.logout);

  app.use('/issue', createIssueRouter(opsClient));
  app.use('/revoke', createRevokeRouter(opsClient));
  app.use('/track', createTrackRouter(opsClient));
  app.use('/verify', createVerifyRouter(verifyClient));

  return app;
}

const PORT = parseInt(process.env.PORT || '5000', 10);
const isMain = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMain) {
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`ScatterID Client Portal Server listening on port ${PORT}`);
  });
}

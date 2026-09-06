// ScatterID Internal Operations Dashboard Backend Service
// Document ID: DEV-ARCH-08 / SEC-OPS-06

import express from 'express';
import helmet from 'helmet';
import { getDb } from '../db/index.js';
import { createRepositories } from '../db/models/index.js';
import { createAuthRouter } from './routes/auth.js';

export function createApp({ db: customDb = null, repos: customRepos = null } = {}) {
  const app = express();
  const db = customDb || getDb();
  const repos = customRepos || createRepositories(db);

  // Non-negotiable security headers & body size clamping (100kb)
  app.use(helmet({
    contentSecurityPolicy: false // Allows inline scripts for plain test harnesses
  }));
  app.use(express.json({ limit: '100kb' }));

  // Health check endpoint
  app.get('/healthz', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'scatterid-ops-dashboard',
      timestamp: new Date().toISOString()
    });
  });

  // Mount Auth Router
  app.use('/api/auth', createAuthRouter({ db, repos }));

  // Global 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  // Global Error handler
  app.use((err, req, res, next) => {
    console.error('[Ops Server Error]:', err);
    res.status(err.status || 500).json({
      error: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred'
    });
  });

  return { app, db, repos };
}

export function startServer(port = process.env.PORT || 8080) {
  const { app } = createApp();
  return app.listen(port, () => {
    console.log(`[ScatterID Ops Dashboard] Listening on port ${port}`);
  });
}

export default createApp;

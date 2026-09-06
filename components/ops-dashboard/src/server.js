// ScatterID Internal Operations Dashboard Backend Service
// Document ID: DEV-ARCH-08 / SEC-OPS-06

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import express from 'express';
import helmet from 'helmet';
import { getDb } from '../db/index.js';
import { createRepositories } from '../db/models/index.js';
import { migrateUp } from '../db/migrations/runner.js';
import { seedInitialData } from '../db/seed.js';
import { createAuthRouter } from './routes/auth.js';
import { createRequestsRouter } from './routes/requests.js';
import { createKeysRouter } from './routes/keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp({ db: customDb = null, repos: customRepos = null } = {}) {
  const app = express();
  const db = customDb || getDb();
  const repos = customRepos || createRepositories(db);

  // Non-negotiable security headers & body size clamping (100kb)
  app.use(helmet({
    contentSecurityPolicy: false // Allows inline scripts for plain test harnesses
  }));
  app.use(express.json({ limit: '100kb' }));

  // Redirect root to index.html router
  app.get('/', (req, res) => {
    res.redirect('/index.html');
  });

  // Serve zero-dependency bare-bones HTML test harness
  app.use(express.static(path.resolve(__dirname, '../public')));

  // Health check endpoint
  app.get('/healthz', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'scatterid-ops-dashboard',
      timestamp: new Date().toISOString()
    });
  });

  // Mount Routers
  app.use('/api/auth', createAuthRouter({ db, repos }));
  app.use('/api/requests', createRequestsRouter({ db, repos }));
  app.use('/api/keys', createKeysRouter({ db, repos }));

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

export async function startServer(port = process.env.PORT || 8080) {
  const db = getDb();
  migrateUp(db);
  const repos = createRepositories(db);
  await seedInitialData(db, repos);

  const { app } = createApp({ db, repos });
  return app.listen(port, () => {
    console.log(`=============================================================`);
    console.log(`  ScatterID Ops Console running at http://0.0.0.0:${port}`);
    console.log(`  Console UI available at http://localhost:${port}/dashboard.html`);
    console.log(`=============================================================`);
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start Ops Dashboard server:', err);
    process.exit(1);
  });
}

export default createApp;

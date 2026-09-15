// components/client-portal/server/src/routes/track.ts
// Forwards request tracking lookup to Ops Dashboard GET /api/requests/track/:id

import { Router, Response } from 'express';
import { AuthenticatedClerkRequest, requireClerkAuth } from '../auth/middleware.js';
import { defaultOpsDashboardClient, OpsDashboardClient } from '../proxy/opsDashboardClient.js';

export function createTrackRouter(client: OpsDashboardClient = defaultOpsDashboardClient): Router {
  const router = Router();

  router.get('/:id', requireClerkAuth, async (req: AuthenticatedClerkRequest, res: Response) => {
    try {
      const { status, data } = await client.forwardTrackRequest(req.params.id, req.authToken!);
      return res.status(status).json(data);
    } catch (err: any) {
      return res.status(502).json({
        error: 'OPS_DASHBOARD_UNREACHABLE',
        message: err.message || 'Failed to forward tracking request to Operations Dashboard',
      });
    }
  });

  return router;
}

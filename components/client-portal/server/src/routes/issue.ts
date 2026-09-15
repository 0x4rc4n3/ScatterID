// components/client-portal/server/src/routes/issue.ts
// Forwards issue-intake requests to Ops Dashboard POST /api/requests/issue

import { Router, Response } from 'express';
import { AuthenticatedClerkRequest, requireClerkAuth } from '../auth/middleware.js';
import { defaultOpsDashboardClient, OpsDashboardClient } from '../proxy/opsDashboardClient.js';

export function createIssueRouter(client: OpsDashboardClient = defaultOpsDashboardClient): Router {
  const router = Router();

  router.post('/', requireClerkAuth, async (req: AuthenticatedClerkRequest, res: Response) => {
    try {
      const { status, data } = await client.forwardIssueRequest(req.body, req.authToken!);
      return res.status(status).json(data);
    } catch (err: any) {
      return res.status(502).json({
        error: 'OPS_DASHBOARD_UNREACHABLE',
        message: err.message || 'Failed to forward issue request to Operations Dashboard',
      });
    }
  });

  return router;
}

// Holder-authenticated proxy to retrieve a credential receipt after approval.
// The receipt token is a bearer secret; it is never forwarded to the browser in a URL.
import { Router, Request, Response } from 'express';
import { defaultOpsDashboardClient, OpsDashboardClient } from '../proxy/opsDashboardClient.js';

export function createClaimantReceiptRouter(client: OpsDashboardClient = defaultOpsDashboardClient): Router {
  const router = Router();

  const handler = async (req: Request, res: Response) => {
    const receiptToken = req.get('X-Claimant-Receipt-Token') || '';
    if (!/^[0-9a-f]{64}$/i.test(receiptToken)) {
      return res.status(401).json({ error: 'INVALID_RECEIPT_TOKEN' });
    }

    try {
      const { status, data } = await client.forwardClaimantReceipt(req.params.id, receiptToken);
      return res.status(status).json(data);
    } catch (err: any) {
      return res.status(502).json({
        error: 'OPS_DASHBOARD_UNREACHABLE',
        message: err.message || 'Failed to retrieve claimant credential receipt',
      });
    }
  };

  router.get('/', handler);
  router.get('/:id', handler);
  return router;
}

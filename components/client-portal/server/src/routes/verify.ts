// components/client-portal/server/src/routes/verify.ts
// Forwards live verification requests to Verification API POST /verify

import { Router, Request, Response } from 'express';
import { defaultVerificationApiClient, VerificationApiClient } from '../proxy/verificationApiClient.js';

export function createVerifyRouter(client: VerificationApiClient = defaultVerificationApiClient): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { status, data } = await client.forwardVerifyRequest(req.body);
      return res.status(status).json(data);
    } catch (err: any) {
      return res.status(502).json({
        error: 'VERIFICATION_API_UNREACHABLE',
        message: err.message || 'Failed to connect to Verification API service',
      });
    }
  });

  return router;
}

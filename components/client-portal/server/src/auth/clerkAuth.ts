// components/client-portal/server/src/auth/clerkAuth.ts
// Clerk login & session verification local to the Counter-VPN gateway service.

import { Request, Response } from 'express';
import { defaultOpsDashboardClient, OpsDashboardClient } from '../proxy/opsDashboardClient.js';

export function createClerkAuthHandler(client: OpsDashboardClient = defaultOpsDashboardClient) {
  return {
    async login(req: Request, res: Response) {
      try {
        const { username, password, totp_code } = req.body || {};
        if (!username || !password) {
          return res.status(400).json({
            error: 'MISSING_CREDENTIALS',
            message: 'Both username and password are required',
          });
        }

        const loginResponse = await client.loginClerk({ username, password, totp_code });
        return res.status(200).json(loginResponse);
      } catch (err: any) {
        return res.status(401).json({
          error: 'AUTH_FAILED',
          message: err.message || 'Authentication failed',
        });
      }
    },

    async me(req: Request, res: Response) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Authorization header' });
      }
      const token = authHeader.substring(7).trim();
      try {
        const user = await client.verifyClerkSession(token);
        return res.status(200).json({ user });
      } catch (err: any) {
        return res.status(401).json({ error: 'INVALID_TOKEN', message: err.message || 'Invalid session' });
      }
    },

    async logout(_req: Request, res: Response) {
      // Stateless token revocation notification
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    },
  };
}

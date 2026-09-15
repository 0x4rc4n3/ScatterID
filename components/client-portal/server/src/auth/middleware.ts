// components/client-portal/server/src/auth/middleware.ts
// Middleware ensuring requests are authorized with a valid clerk bearer token.

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedClerkRequest extends Request {
  authToken?: string;
}

export function requireClerkAuth(req: AuthenticatedClerkRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header. Expected "Bearer <token>"',
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Empty bearer token',
    });
  }

  req.authToken = token;
  next();
}

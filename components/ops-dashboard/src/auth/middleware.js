// Authentication & Role-Based Access Control Middleware
// Enforces Structural Privilege Separation (Clerk, Mod, Root)

import { verifyToken } from './tokens.js';

/**
 * Extracts client IP address defensively.
 */
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         '127.0.0.1';
}

/**
 * Authenticates request via Authorization: Bearer <token>.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header. Expected "Bearer <token>"'
    });
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: err.message || 'Token verification failed'
    });
  }
}

/**
 * Middleware factory enforcing specific role(s).
 * Examples: requireRole('root'), requireRole(['mod', 'root']), requireRole('clerk')
 */
export function requireRole(allowedRoles) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User identity not found on request context'
      });
    }

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_PRIVILEGES',
        message: `Action denied: role '${req.user.role}' is not authorized. Required: ${rolesArray.join(', ')}`
      });
    }

    next();
  };
}

export default {
  authenticate,
  requireRole,
  getClientIp
};

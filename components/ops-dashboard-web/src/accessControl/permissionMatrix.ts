// components/ops-dashboard-web/src/accessControl/permissionMatrix.ts
// Literal data version of the permission matrix, authoritative per §6

import { UserRole } from '../types/user.js';

export interface PermissionCheck {
  resource: string;
  action: string;
}

export const PERMISSION_MATRIX: Record<UserRole, Record<string, string[]>> = {
  root: {
    overview: ['read'],
    credentials: ['read', 'show'],
    moderationQueue: ['read', 'show'],
    pendingRequests: ['read', 'show', 'decide'],
    awaitingAccept: ['read', 'decide', 'execute'],
    flagged: ['read', 'decide', 'execute'],
    keyRotation: ['read', 'rotate', 'pre-stage', 'promote', 'delegation', 'export', 'restore'],
    auditLog: ['read', 'export'],
    systemHealth: ['read', 'reconcile'],
    policy: ['read', 'write'],
    governance: ['read', 'write'],
    profile: ['read', 'mfa'],
    userManagement: ['read', 'reset-password-all'],
  },
  mod: {
    overview: ['read'],
    credentials: ['read', 'show'],
    moderationQueue: ['read', 'show'],
    pendingRequests: ['read', 'show', 'decide'], // mod can decide
    awaitingAccept: [], // inaccessible
    flagged: [], // inaccessible
    keyRotation: ['read'], // view pool / status only
    auditLog: ['read', 'export'],
    systemHealth: ['read'], // view only
    policy: ['read'], // read-only
    governance: ['read'], // read-only
    profile: ['read', 'mfa'],
    userManagement: ['read', 'reset-password-clerk'], // reset clerks only
  },
  clerk: {
    // Clerks do not use the internal Ops Dashboard; they operate on the Counter-VPN Client Portal
    overview: [],
    credentials: [],
    moderationQueue: [],
    pendingRequests: [],
    awaitingAccept: [],
    flagged: [],
    keyRotation: [],
    auditLog: [],
    systemHealth: [],
    policy: [],
    profile: ['read'],
    userManagement: [],
  },
};

export function checkPermission(role: UserRole | undefined, resource: string, action: string = 'read'): boolean {
  if (!role || !PERMISSION_MATRIX[role]) {
    return false;
  }
  const allowedActions = PERMISSION_MATRIX[role][resource] || [];
  return allowedActions.includes(action);
}

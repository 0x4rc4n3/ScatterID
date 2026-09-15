// components/ops-dashboard-web/src/accessControl/accessControlProvider.ts
import { checkPermission } from './permissionMatrix.js';
import { UserRole } from '../types/user.js';

export interface AccessControlProvider {
  canAccess: (params: { resource: string; action: string; record?: any }) => Promise<boolean>;
}

export function createAccessControlProvider(getRole: () => UserRole | undefined): AccessControlProvider {
  return {
    async canAccess({ resource, action = 'read' }) {
      const role = getRole();
      return checkPermission(role, resource, action);
    },
  };
}

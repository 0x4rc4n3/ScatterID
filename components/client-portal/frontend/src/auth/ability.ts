// components/client-portal/frontend/src/auth/ability.ts
// CASL Ability definition for Counter-VPN Client Portal Role-Based Access Control

import { createMongoAbility, MongoAbility, AbilityBuilder } from '@casl/ability';
import type { ClerkUser } from './AuthContext.js';

export type DeskAction = 'access';
export type DeskSubject = 'VerifyDesk' | 'IssueDesk' | 'RevokeDesk';

export type AppAbility = MongoAbility<[DeskAction, DeskSubject]>;

/**
 * Builds CASL MongoAbility instance based on the authenticated ClerkUser's permissions.
 *
 * Rules:
 * 1. Base counter clerk: can access 'VerifyDesk' (safe default)
 * 2. If user has 'can_issue' permission or all-desk default: can access 'IssueDesk'
 * 3. If user has 'can_revoke' permission or all-desk default: can access 'RevokeDesk'
 */
export function buildAbilityForUser(user: ClerkUser | null): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    return build();
  }

  // Base permission: All counter clerks can perform verification
  can('access', 'VerifyDesk');

  // Fine-grained permission capabilities:
  // If explicit permissions array is provided, evaluate permissions.
  // If permissions are not configured/empty, grant standard clerk access to all desks.
  const permissions = user.permissions && user.permissions.length > 0
    ? user.permissions
    : ['can_verify', 'can_issue', 'can_revoke'];

  if (permissions.includes('can_issue')) {
    can('access', 'IssueDesk');
  }

  if (permissions.includes('can_revoke')) {
    can('access', 'RevokeDesk');
  }

  return build();
}

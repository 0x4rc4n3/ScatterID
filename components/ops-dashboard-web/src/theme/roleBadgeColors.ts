// components/ops-dashboard-web/src/theme/roleBadgeColors.ts
import { tokens } from '@scatterid/design-tokens';
import { UserRole } from '../types/user.js';

export function getRoleColor(role: UserRole | string): string {
  switch (role) {
    case 'root':
      return tokens.color.rootTier;
    case 'mod':
      return tokens.color.brand700;
    case 'clerk':
      return tokens.color.cyanMid;
    default:
      return tokens.color.slate500;
  }
}

export function getRoleBackgroundColor(role: UserRole | string): string {
  switch (role) {
    case 'root':
      return tokens.color.purpleLight;
    case 'mod':
      return tokens.color.brand50;
    case 'clerk':
      return tokens.color.slate100;
    default:
      return tokens.color.slate100;
  }
}

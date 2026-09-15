// components/ops-dashboard-web/src/types/user.ts

export type UserRole = 'root' | 'mod' | 'clerk';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  station_id?: string | null;
  totp_enabled: boolean;
  force_password_reset?: boolean;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

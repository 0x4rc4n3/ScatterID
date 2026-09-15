// components/ops-dashboard-web/src/authProvider/index.ts
import { AuthProvider } from 'react-admin';
import { ENDPOINTS } from '../dataProvider/endpoints.js';
import { UserProfile } from '../types/user.js';
import { createAccessControlProvider } from '../accessControl/accessControlProvider.js';

let currentUserCache: UserProfile | null = null;

const accessControl = createAccessControlProvider(() => {
  if (currentUserCache) return (currentUserCache as any).role;
  const stored = localStorage.getItem('scatterid_user');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return (parsed.user || parsed).role;
    } catch {
      return undefined;
    }
  }
  return undefined;
});

export const authProvider: AuthProvider = {
  async login(credentials: any) {
    const { username, password, totp_code, recovery_code, force_onboarding } = credentials;
    const response = await fetch(ENDPOINTS.auth.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, totp_code, recovery_code, force_onboarding }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || data.error || 'Authentication failed');
      (error as any).status = response.status;
      (error as any).body = data;
      throw error;
    }

    if (data.requireFirstTimeSetup) {
      sessionStorage.setItem('scatterid_temp_token', data.tempToken);
      sessionStorage.setItem('scatterid_mfa_setup', JSON.stringify(data.mfaSetup || {}));
      sessionStorage.setItem('scatterid_pending_user', JSON.stringify({ username: data.username, role: data.role }));
      const setupErr = new Error('FIRST_TIME_SETUP_REQUIRED');
      (setupErr as any).setupRequired = true;
      (setupErr as any).setupData = data;
      throw setupErr;
    }

    if (!data.token) {
      throw new Error('Authentication response did not contain session token');
    }

    localStorage.setItem('scatterid_token', data.token);

    // Fetch authoritative server identity per §6 (GET /api/auth/me)
    const meRes = await fetch(ENDPOINTS.auth.me, {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    if (!meRes.ok) {
      localStorage.removeItem('scatterid_token');
      throw new Error('Failed to retrieve user identity from /api/auth/me');
    }

    const meData = await meRes.json();
    const userData = meData.user || meData;
    currentUserCache = userData;
    localStorage.setItem('scatterid_user', JSON.stringify(userData));

    return Promise.resolve();
  },

  async logout() {
    const token = localStorage.getItem('scatterid_token');
    if (token) {
      try {
        await fetch(ENDPOINTS.auth.logout, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.warn('Logout notification to backend failed:', err);
      }
    }
    localStorage.removeItem('scatterid_token');
    localStorage.removeItem('scatterid_user');
    sessionStorage.clear();
    currentUserCache = null;
    return Promise.resolve();
  },

  async checkAuth() {
    const token = localStorage.getItem('scatterid_token');
    if (!token) {
      return Promise.reject({ message: 'Authentication required' });
    }

    // Live verification against GET /api/auth/me to enforce server-side token revocation
    try {
      const meRes = await fetch(ENDPOINTS.auth.me, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) {
        localStorage.removeItem('scatterid_token');
        localStorage.removeItem('scatterid_user');
        currentUserCache = null;
        return Promise.reject({ message: 'Session invalid or revoked' });
      }
      const meData = await meRes.json();
      const userData = meData.user || meData;
      currentUserCache = userData;
      localStorage.setItem('scatterid_user', JSON.stringify(userData));
      return Promise.resolve();
    } catch {
      // Offline fallback: if network glitch, check cached token existence
      return Promise.resolve();
    }
  },

  async checkError(error) {
    const status = error.status || (error.response && error.response.status);
    if (status === 401 || status === 403) {
      localStorage.removeItem('scatterid_token');
      localStorage.removeItem('scatterid_user');
      currentUserCache = null;
      return Promise.reject();
    }
    return Promise.resolve();
  },

  async getIdentity() {
    let u: any = currentUserCache;
    if (!u) {
      const stored = localStorage.getItem('scatterid_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          u = parsed.user || parsed;
        } catch {}
      }
    }
    if (u && u.username) {
      const role = u.role || 'staff';
      return {
        id: u.id,
        fullName: `${u.username} (${role.toUpperCase()})`,
        avatar: undefined,
        role: role,
      };
    }
    return { id: 'unknown', fullName: 'Staff User' };
  },

  async getPermissions() {
    if (currentUserCache) {
      return (currentUserCache as any).role;
    }
    const stored = localStorage.getItem('scatterid_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return (parsed.user || parsed).role;
      } catch {}
    }
    return null;
  },

  async canAccess(params: any) {
    return accessControl.canAccess(params);
  },
};

export function getCachedCurrentUser(): UserProfile | null {
  if (currentUserCache) return currentUserCache;
  const stored = localStorage.getItem('scatterid_user');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.user || parsed;
    } catch {
      return null;
    }
  }
  return null;
}

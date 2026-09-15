// components/client-portal/frontend/src/auth/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { portalHttpClient } from '../api/httpClient.js';

export interface ClerkUser {
  id: string;
  username: string;
  role: string;
  station_id?: string;
  permissions?: string[];
}

export interface AuthContextValue {
  user: ClerkUser | null;
  token: string | null;
  stationId: string;
  login: (credentials: { username: string; password: string; totp_code?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ClerkUser | null>(() => {
    const saved = localStorage.getItem('scatterid_clerk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('scatterid_clerk_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const stationId = user?.station_id || 'COUNTER-STATION-01';

  const checkSession = useCallback(async () => {
    const savedToken = localStorage.getItem('scatterid_clerk_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await portalHttpClient<{ user: ClerkUser }>('/auth/me');
      setUser(res.user);
      localStorage.setItem('scatterid_clerk_user', JSON.stringify(res.user));
    } catch {
      localStorage.removeItem('scatterid_clerk_token');
      localStorage.removeItem('scatterid_clerk_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (credentials: { username: string; password: string; totp_code?: string }) => {
    const res = await portalHttpClient<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      localStorage.setItem('scatterid_clerk_token', res.token);
      localStorage.setItem('scatterid_clerk_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
    } else {
      throw new Error('No session token returned by gateway');
    }
  };

  const logout = async () => {
    try {
      await portalHttpClient('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('scatterid_clerk_token');
    localStorage.removeItem('scatterid_clerk_user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, stationId, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

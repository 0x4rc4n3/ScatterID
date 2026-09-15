// components/client-portal/frontend/src/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from './useAuth.js';
import { ShieldCheck, Lock, User, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide your clerk credentials.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await login({
        username,
        password,
        totp_code: totpCode.trim() || undefined,
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgLight flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-borderLight p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-brand500 flex items-center justify-center text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-textOnLight">ScatterID Client Portal</h1>
            <p className="text-xs text-textLightMuted font-medium">Counter Desk Authentication</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-textOnLight mb-1">Clerk Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textLightMuted">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. clerk_john"
                className="w-full pl-9 pr-3 py-2 text-sm border border-borderLight rounded-md focus:outline-none focus:border-brand500 bg-bgLight"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textOnLight mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textLightMuted">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-borderLight rounded-md focus:outline-none focus:border-brand500 bg-bgLight"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textOnLight mb-1">
              TOTP Code <span className="text-textLightMuted font-normal">(Optional for seed clerks)</span>
            </label>
            <input
              type="text"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:outline-none focus:border-brand500 bg-bgLight font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-brand500 hover:bg-brand700 text-white font-semibold text-sm rounded-md transition duration-150 disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : 'Sign In to Counter Desk'}
          </button>

          <button
            type="button"
            onClick={() => {
              setUsername('clerk_john');
              setPassword('ScatterID2026!');
            }}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md transition duration-150 border border-slate-300"
          >
            ⚡ Auto-Fill Test Clerk (clerk_john / ScatterID2026!)
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-borderLight text-center">
          <p className="text-xs text-textLightMuted">
            Secure Counter VPN Service • FIPS 204 ML-DSA-65
          </p>
        </div>
      </div>
    </div>
  );
};

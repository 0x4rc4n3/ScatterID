// components/client-portal/server/src/proxy/opsDashboardClient.ts
// Server-to-server forwarder to Ops Dashboard private management network.
// This proxy service holds no signing keys and no admin credentials.

export interface OpsClientConfig {
  opsDashboardUrl: string;
}

export class OpsDashboardClient {
  private baseUrl: string;

  constructor(config?: Partial<OpsClientConfig>) {
    this.baseUrl = config?.opsDashboardUrl || process.env.OPS_DASHBOARD_URL || 'http://localhost:8080';
  }

  async loginClerk(credentials: { username: string; password: string; totp_code?: string }) {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Clerk authentication failed');
    }
    if (data.user && data.user.role !== 'clerk') {
      throw new Error('Access denied: Client portal is restricted to counter clerk staff');
    }
    return data;
  }

  async verifyClerkSession(token: string) {
    const res = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Invalid session token');
    }
    const user = data.user || data;
    if (user.role !== 'clerk') {
      throw new Error('Access denied: Client portal is restricted to counter clerk staff');
    }
    return user;
  }

  async forwardIssueRequest(payload: unknown, authToken: string) {
    const res = await fetch(`${this.baseUrl}/api/requests/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async forwardRevokeRequest(payload: unknown, authToken: string) {
    const res = await fetch(`${this.baseUrl}/api/requests/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async forwardTrackRequest(requestId: string, authToken: string) {
    const res = await fetch(`${this.baseUrl}/api/requests/track/${encodeURIComponent(requestId)}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const data = await res.json();
    return { status: res.status, data };
  }
}

export const defaultOpsDashboardClient = new OpsDashboardClient();

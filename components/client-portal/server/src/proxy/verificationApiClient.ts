// components/client-portal/server/src/proxy/verificationApiClient.ts
// Direct server-to-server forwarder to verification-api's POST /verify

export interface VerificationClientConfig {
  verificationApiUrl: string;
}

export class VerificationApiClient {
  private baseUrl: string;

  constructor(config?: Partial<VerificationClientConfig>) {
    this.baseUrl = config?.verificationApiUrl || process.env.VERIFICATION_API_URL || 'http://localhost:3000';
  }

  async forwardVerifyRequest(payload: { credentialId?: string; dataHash?: string }) {
    const res = await fetch(`${this.baseUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { status: res.status, data };
  }
}

export const defaultVerificationApiClient = new VerificationApiClient();

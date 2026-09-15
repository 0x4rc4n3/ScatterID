// components/client-portal/frontend/src/api/httpClient.ts
// Communicates ONLY with the Client Portal Counter-VPN proxy service.
// Zero knowledge of ops-dashboard or verification-api direct hostnames.

export async function portalHttpClient<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('scatterid_clerk_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('scatterid_clerk_token');
    localStorage.removeItem('scatterid_clerk_user');
  }

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).body = data;
    throw err;
  }

  return data;
}

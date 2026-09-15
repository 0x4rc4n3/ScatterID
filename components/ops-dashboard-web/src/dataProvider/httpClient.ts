// components/ops-dashboard-web/src/dataProvider/httpClient.ts
// Shared authenticated HTTP client for ops dashboard with token injection and 401 handling.

export interface FetchOptions extends RequestInit {
  token?: string;
}

export async function httpClient(url: string, options: FetchOptions = {}): Promise<any> {
  const token = options.token || localStorage.getItem('scatterid_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('scatterid_token');
    localStorage.removeItem('scatterid_user');
    window.location.hash = '#/login';
    throw new Error('Session expired or unauthorized');
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

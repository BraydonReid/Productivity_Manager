import { API_BASE } from '../shared/constants';

async function getAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('authToken');
    return result.authToken || null;
  } catch {
    return null;
  }
}

export async function serverRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function postToServer<T>(path: string, body: unknown): Promise<T | null> {
  return serverRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function putToServer<T>(path: string, body: unknown): Promise<T | null> {
  return serverRequest<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_EMAIL_KEY = 'authEmail';

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_TOKEN_KEY);
  return result[AUTH_TOKEN_KEY] || null;
}

export async function setAuth(token: string, email: string): Promise<void> {
  await chrome.storage.local.set({ [AUTH_TOKEN_KEY]: token, [AUTH_EMAIL_KEY]: email });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([AUTH_TOKEN_KEY, AUTH_EMAIL_KEY]);
}

export async function getAuthEmail(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_EMAIL_KEY);
  return result[AUTH_EMAIL_KEY] || null;
}

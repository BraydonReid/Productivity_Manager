// Update SERVER_URL after Railway deployment:
// export const SERVER_URL = 'https://YOUR_APP.up.railway.app';
export const SERVER_URL = 'http://localhost:3712';
export const API_BASE = `${SERVER_URL}/api`;

export const SYNC_INTERVAL_MINUTES = 0.5; // 30 seconds
export const CLIPBOARD_CHECK_INTERVAL_MINUTES = 0.05; // ~3 seconds
export const SCROLL_DEBOUNCE_MS = 2000;

export const ALARM_NAMES = {
  SYNC_TO_SERVER: 'sync-to-server',
  CLIPBOARD_CHECK: 'clipboard-check',
} as const;

export const STORAGE_KEYS = {
  CURRENT_SESSION_ID: 'currentSessionId',
  LAST_SYNC: 'lastSyncTimestamp',
  LAST_CLIPBOARD: 'lastClipboardContent',
  AUTH_TOKEN: 'authToken',
  AUTH_EMAIL: 'authEmail',
} as const;

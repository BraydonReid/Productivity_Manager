import { STORAGE_KEYS } from '../shared/constants';
import { postToServer } from './server-bridge';
import { v4 as uuid } from 'uuid';

export async function checkClipboard(currentSessionId: string | null): Promise<void> {
  if (!currentSessionId) return;

  try {
    // Read clipboard text - requires clipboardRead permission and user gesture or focused document
    // In service worker context, we attempt to read via offscreen document or fallback
    const text = await readClipboardText();
    if (!text) return;

    const stored = await chrome.storage.local.get(STORAGE_KEYS.LAST_CLIPBOARD);
    const lastContent = stored[STORAGE_KEYS.LAST_CLIPBOARD];

    if (text === lastContent) return;

    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_CLIPBOARD]: text,
    });

    // Get the active tab URL as source
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const entry = {
      id: uuid(),
      sessionId: currentSessionId,
      content: text.substring(0, 5000), // Limit to 5000 chars
      sourceUrl: activeTab?.url || null,
      capturedAt: new Date().toISOString(),
      contentType: detectContentType(text),
    };

    await postToServer('/clipboard', entry);
  } catch {
    // Clipboard access may fail silently in service worker context
  }
}

function detectContentType(text: string): string {
  if (/^https?:\/\//.test(text.trim())) return 'url';
  if (/[{}\[\]();]/.test(text) && /\n/.test(text)) return 'code';
  return 'text';
}

async function readClipboardText(): Promise<string | null> {
  try {
    // In MV3 service workers, direct clipboard access is limited.
    // We use the offscreen API if available, otherwise skip.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    return null;
  } catch {
    return null;
  }
}

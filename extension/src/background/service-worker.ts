import {
  initSession,
  onTabUpdated,
  onTabRemoved,
  onTabActivated,
  onWindowFocusChanged,
  syncToServer,
  saveSession,
  getCurrentSession,
  updateScrollPosition,
  getSessionNamingInfo,
  applyAIName,
} from './session-tracker';
import { checkClipboard } from './clipboard-monitor';
import {
  startFocusMode,
  endFocusMode,
  getFocusStatus,
  onTabCreatedDuringFocus,
  onFocusTick,
  restoreFocusState,
} from './focus-mode';
import { autoGroupByDomain, autoGroupByAI } from './auto-group';
import { postToServer, serverRequest } from './server-bridge';
import {
  API_BASE,
  ALARM_NAMES,
  SYNC_INTERVAL_MINUTES,
  CLIPBOARD_CHECK_INTERVAL_MINUTES,
  STORAGE_KEYS,
} from '../shared/constants';
import { v4 as uuid } from 'uuid';
import type { ExtensionMessage } from '../shared/types';

// Authenticated fetch — reads JWT from storage and adds Authorization header
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { authToken } = await chrome.storage.local.get('authToken');
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers as Record<string, string> || {}),
    },
  });
}

// Initialize session and restore focus state on service worker startup
initSession();
restoreFocusState();

// Register alarms on install
chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create(ALARM_NAMES.SYNC_TO_SERVER, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  chrome.alarms.create(ALARM_NAMES.CLIPBOARD_CHECK, {
    periodInMinutes: CLIPBOARD_CHECK_INTERVAL_MINUTES,
  });

  // Open onboarding wizard on first install
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/dashboard/index.html') + '#/onboarding',
    });
  }
});

// Also ensure alarms exist on startup (they may have been cleared)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAMES.SYNC_TO_SERVER, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  chrome.alarms.create(ALARM_NAMES.CLIPBOARD_CHECK, {
    periodInMinutes: CLIPBOARD_CHECK_INTERVAL_MINUTES,
  });
  initSession();
});

// Tab event listeners (must be at top level for MV3)
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.tabs.onActivated.addListener(onTabActivated);
chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

// Track new tab creation for focus mode
chrome.tabs.onCreated.addListener((tab) => {
  onTabCreatedDuringFocus(tab);
});

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.SYNC_TO_SERVER) {
    await syncToServer();
    // Auto-name the session with AI once it has enough tabs
    const namingInfo = getSessionNamingInfo();
    if (namingInfo && !namingInfo.hasBeenNamed && namingInfo.tabCount >= 3) {
      try {
        const res = await authedFetch(`${API_BASE}/ai/name-session`, {
          method: 'POST',
          body: JSON.stringify({ sessionId: namingInfo.id }),
        });
        if (res.ok) {
          const { name } = await res.json();
          if (name) await applyAIName(name);
        }
      } catch {}
    }
  } else if (alarm.name === ALARM_NAMES.CLIPBOARD_CHECK) {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
    await checkClipboard(stored[STORAGE_KEYS.CURRENT_SESSION_ID] || null);
  } else if (alarm.name === 'focus-end') {
    await endFocusMode();
  } else if (alarm.name === 'focus-tick') {
    onFocusTick();
  }
});

// Keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-session') {
    await saveSession();
  } else if (command === 'toggle-sidebar') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      sendToContentScript(tab.id, { type: 'TOGGLE_SIDEBAR' });
    }
  } else if (command === 'toggle-command-menu') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      sendToContentScript(tab.id, { type: 'TOGGLE_COMMAND_MENU' });
    }
  }
});

// Message routing
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep message channel open for async response
  }
);

// Wait for a tab to finish loading
function waitForTabComplete(tabId: number, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);

    function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Extra delay for SPA hydration
        setTimeout(resolve, 500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Ensure content script is injected, then send a message to the tab
async function sendToContentScript(tabId: number, message: { type: string; payload?: unknown }): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script not loaded — inject it first
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
    // Small delay for script to initialize
    await new Promise((r) => setTimeout(r, 100));
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'GET_CURRENT_SESSION':
      return getCurrentSession();

    case 'SAVE_SESSION':
      return saveSession(message.payload.name);

    case 'RESTORE_SESSION': {
      const res = await authedFetch(
        `${API_BASE}/sessions/${message.payload.sessionId}/restore`,
        { method: 'POST' }
      );
      if (!res.ok) return null;
      const data = await res.json();

      // Open tabs and track those needing scroll restoration
      const tabsToScroll: { tabId: number; x: number; y: number }[] = [];
      for (const tab of data.tabs || []) {
        const created = await chrome.tabs.create({ url: tab.url });
        if (created.id && tab.scrollPosition && (tab.scrollPosition.x > 0 || tab.scrollPosition.y > 0)) {
          tabsToScroll.push({ tabId: created.id, x: tab.scrollPosition.x, y: tab.scrollPosition.y });
        }
      }

      // Restore scroll positions after tabs finish loading
      for (const { tabId, x, y } of tabsToScroll) {
        try {
          await waitForTabComplete(tabId);
          await sendToContentScript(tabId, { type: 'RESTORE_SCROLL', payload: { x, y } });
        } catch {
          // Tab may not support content scripts
        }
      }

      return data;
    }

    case 'ADD_NOTE': {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
      const sessionId = stored[STORAGE_KEYS.CURRENT_SESSION_ID];
      if (!sessionId) return null;
      return postToServer('/notes', {
        id: uuid(),
        sessionId,
        tabId: null,
        url: message.payload.url || null,
        content: message.payload.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    case 'TOGGLE_SIDEBAR': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await sendToContentScript(tab.id, { type: 'TOGGLE_SIDEBAR' });
      }
      return { ok: true };
    }

    case 'SCROLL_POSITION_UPDATE': {
      if (sender.tab?.id) {
        updateScrollPosition(sender.tab.id, message.payload);
      }
      return { ok: true };
    }

    case 'GET_RECENT_SESSIONS': {
      try {
        const res = await authedFetch(
          `${API_BASE}/sessions?limit=5&sort=updatedAt`
        );
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }

    case 'START_FOCUS': {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
      return startFocusMode(
        message.payload.goal,
        message.payload.durationMinutes,
        stored[STORAGE_KEYS.CURRENT_SESSION_ID] || null
      );
    }

    case 'END_FOCUS':
      return endFocusMode();

    case 'GET_FOCUS_STATUS':
      return getFocusStatus();

    case 'ANALYZE_PAGE': {
      try {
        // Get the active tab and extract its content
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id || !activeTab.url || activeTab.url.startsWith('chrome://')) {
          return { error: 'No analyzable tab active' };
        }

        const pageContent = await sendToContentScript(activeTab.id, { type: 'GET_PAGE_CONTENT' });
        if (!pageContent?.content) {
          return { error: 'Could not extract page content' };
        }

        // Merge structured data into content for AI
        const fullContent = pageContent.structuredData
          ? `${pageContent.content}\n\n=== STRUCTURED DATA ===\n${pageContent.structuredData}`
          : pageContent.content;

        // Send to server for AI analysis
        const res = await authedFetch(`${API_BASE}/ai/analyze-page`, {
          method: 'POST',
          body: JSON.stringify({ title: pageContent.title, url: pageContent.url, content: fullContent }),
        });
        if (!res.ok) return { error: 'AI analysis failed' };
        const { notes } = await res.json();

        // Save each note for this page
        const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
        const sessionId = stored[STORAGE_KEYS.CURRENT_SESSION_ID];
        if (sessionId && notes?.length) {
          const combinedNote = `[AI Analysis] ${pageContent.title}\n\n${notes.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}`;
          await postToServer('/notes', {
            id: uuid(),
            sessionId,
            tabId: null,
            url: activeTab.url,
            content: combinedNote,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        return { success: true, notes, url: activeTab.url, title: pageContent.title };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    case 'ANALYZE_ALL_TABS': {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
        const sessionId = stored[STORAGE_KEYS.CURRENT_SESSION_ID];
        if (!sessionId) return { error: 'No active session' };

        // Get all non-chrome tabs
        const allTabs = await chrome.tabs.query({});
        const analyzableTabs = allTabs.filter(
          (t) => t.id && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
        );

        const results: { url: string; title: string; notes: string[]; error?: string }[] = [];

        for (const tab of analyzableTabs) {
          try {
            const pageContent = await sendToContentScript(tab.id!, { type: 'GET_PAGE_CONTENT' });
            if (!pageContent?.content) {
              results.push({ url: tab.url!, title: tab.title || '', notes: [], error: 'No content' });
              continue;
            }

            const fullContent = pageContent.structuredData
              ? `${pageContent.content}\n\n=== STRUCTURED DATA ===\n${pageContent.structuredData}`
              : pageContent.content;

            const res = await authedFetch(`${API_BASE}/ai/analyze-page`, {
              method: 'POST',
              body: JSON.stringify({ title: pageContent.title, url: pageContent.url, content: fullContent }),
            });

            if (!res.ok) {
              results.push({ url: tab.url!, title: tab.title || '', notes: [], error: 'AI failed' });
              continue;
            }

            const { notes } = await res.json();
            if (notes?.length) {
              const combinedNote = `[AI Analysis] ${pageContent.title}\n\n${notes.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}`;
              await postToServer('/notes', {
                id: uuid(),
                sessionId,
                tabId: null,
                url: tab.url,
                content: combinedNote,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
            results.push({ url: tab.url!, title: pageContent.title, notes: notes || [] });
          } catch {
            results.push({ url: tab.url!, title: tab.title || '', notes: [], error: 'Tab unreachable' });
          }
        }

        return { success: true, results, totalAnalyzed: results.filter((r) => r.notes.length > 0).length };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    case 'ASK_PAGE': {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id || !activeTab.url || activeTab.url.startsWith('chrome://')) {
          return { error: 'No analyzable tab active' };
        }

        const pageContent = await sendToContentScript(activeTab.id, { type: 'GET_PAGE_CONTENT' });
        if (!pageContent?.content) {
          return { error: 'Could not extract page content' };
        }

        // Append structured data (tables, tier lists, etc.) so AI can answer questions about them
        const fullContent = pageContent.structuredData
          ? `${pageContent.content}\n\n=== STRUCTURED DATA (tables, tier lists, etc.) ===\n${pageContent.structuredData}`
          : pageContent.content;

        const res = await authedFetch(`${API_BASE}/ai/chat-page`, {
          method: 'POST',
          body: JSON.stringify({
            title: pageContent.title,
            url: pageContent.url,
            content: fullContent,
            question: message.payload.question,
            history: message.payload.history || [],
          }),
        });

        if (!res.ok) return { error: 'Chat request failed' };
        const { answer } = await res.json();
        return { success: true, answer };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    case 'EXPORT_PAGE_DATA': {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id || !activeTab.url || activeTab.url.startsWith('chrome://')) {
          return { error: 'No exportable tab active' };
        }
        const data = await sendToContentScript(activeTab.id, { type: 'GET_EXPORT_DATA' });
        return { success: true, data };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    case 'AUTO_GROUP_TABS': {
      try {
        const groups = message.payload?.useAI
          ? await autoGroupByAI()
          : await autoGroupByDomain();
        return { success: true, groups };
      } catch (err) {
        return { error: (err as Error).message };
      }
    }

    case 'COMMAND_EXECUTE': {
      const { command, args } = message.payload;
      switch (command) {
        case 'save-session':
          return saveSession(args?.name);
        case 'restore-session':
          return handleMessage({ type: 'RESTORE_SESSION', payload: { sessionId: args.sessionId } } as ExtensionMessage, sender);
        case 'toggle-focus':
          if ((await getFocusStatus()).isActive) return endFocusMode();
          return { needsInput: true, type: 'focus' };
        case 'toggle-sidebar':
          return handleMessage({ type: 'TOGGLE_SIDEBAR' } as ExtensionMessage, sender);
        case 'open-dashboard':
          await chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
          return { ok: true };
        case 'auto-group':
          return handleMessage({ type: 'AUTO_GROUP_TABS', payload: { useAI: false } } as ExtensionMessage, sender);
        case 'auto-group-ai':
          return handleMessage({ type: 'AUTO_GROUP_TABS', payload: { useAI: true } } as ExtensionMessage, sender);
        case 'analyze-page':
          return handleMessage({ type: 'ANALYZE_PAGE' } as ExtensionMessage, sender);
        default:
          return null;
      }
    }

    case 'GET_CLIPBOARD_ENTRIES': {
      try {
        const params = new URLSearchParams();
        if (message.payload.sessionId) params.set('sessionId', message.payload.sessionId);
        if (message.payload.limit) params.set('limit', String(message.payload.limit));
        const res = await authedFetch(
          `${API_BASE}/clipboard?${params.toString()}`
        );
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }

    case 'REQUEST_AI_SUMMARY': {
      try {
        const res = await authedFetch(`${API_BASE}/ai/summarize-session`, {
          method: 'POST',
          body: JSON.stringify({ sessionId: message.payload.sessionId }),
        });
        if (!res.ok) return { error: 'Summary generation failed' };
        return res.json();
      } catch {
        return { error: 'Server unavailable' };
      }
    }

    case 'GET_NOTES': {
      try {
        const params = new URLSearchParams();
        if (message.payload.sessionId) params.set('sessionId', message.payload.sessionId);
        if (message.payload.url) params.set('url', message.payload.url);
        const res = await authedFetch(
          `${API_BASE}/notes?${params.toString()}`
        );
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }

    default:
      return null;
  }
}

import { v4 as uuid } from 'uuid';
import { STORAGE_KEYS } from '../shared/constants';
import { postToServer, putToServer } from './server-bridge';
import type { Session, Tab, ScrollPosition } from '../shared/types';

interface TrackedTab {
  id: string;
  chromeTabId: number;
  windowId: number;
  index: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  openedAt: string;
  closedAt: string | null;
  lastActiveAt: string;
  activeTime: number;
  activeSince: number | null;
  scrollPosition: ScrollPosition;
  visitOrder: number;
}

interface SessionData {
  id: string;
  name: string;
  hasBeenNamed: boolean;
  createdAt: string;
  tabs: Map<number, TrackedTab>;
  totalActiveTime: number;
  contextSwitchCount: number;
  lastActiveDomain: string | null;
  deepWorkStart: number | null;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  uniqueDomains: Set<string>;
  visitCounter: number;
}

let currentSession: SessionData | null = null;
let activeTabId: number | null = null;

export async function initSession(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION_ID);
  const sessionId = stored[STORAGE_KEYS.CURRENT_SESSION_ID];

  if (sessionId) {
    const sessionData = await chrome.storage.local.get(`session_${sessionId}`);
    const raw = sessionData[`session_${sessionId}`];
    if (raw) {
      currentSession = {
        ...raw,
        tabs: new Map(Object.entries(raw.tabs || {}).map(([k, v]) => [Number(k), v as TrackedTab])),
        uniqueDomains: new Set(raw.uniqueDomains || []),
        hasBeenNamed: raw.hasBeenNamed ?? !raw.name?.startsWith('Session '),
        contextSwitchCount: raw.contextSwitchCount || 0,
        lastActiveDomain: raw.lastActiveDomain || null,
        deepWorkStart: raw.deepWorkStart || null,
        deepWorkMinutes: raw.deepWorkMinutes || 0,
        shallowWorkMinutes: raw.shallowWorkMinutes || 0,
        visitCounter: raw.visitCounter || 0,
      };
      return;
    }
  }

  await createNewSession();
}

async function createNewSession(name?: string): Promise<SessionData> {
  const id = uuid();
  const now = new Date().toISOString();

  currentSession = {
    id,
    name: name || `Session ${new Date().toLocaleString()}`,
    hasBeenNamed: !!name,
    createdAt: now,
    tabs: new Map(),
    totalActiveTime: 0,
    contextSwitchCount: 0,
    lastActiveDomain: null,
    deepWorkStart: null,
    deepWorkMinutes: 0,
    shallowWorkMinutes: 0,
    uniqueDomains: new Set(),
    visitCounter: 0,
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.CURRENT_SESSION_ID]: id,
  });

  // Capture currently open tabs
  const existingTabs = await chrome.tabs.query({});
  for (const tab of existingTabs) {
    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
      trackTab(tab.id, tab);
    }
  }

  await persistLocally();
  return currentSession;
}

function trackTab(chromeTabId: number, tab: chrome.tabs.Tab): void {
  if (!currentSession) return;

  const existing = currentSession.tabs.get(chromeTabId);
  if (existing) {
    existing.url = tab.url || existing.url;
    existing.title = tab.title || existing.title;
    existing.favIconUrl = tab.favIconUrl || existing.favIconUrl;
    return;
  }

  const now = new Date().toISOString();
  currentSession.tabs.set(chromeTabId, {
    id: uuid(),
    chromeTabId,
    windowId: tab.windowId || 0,
    index: tab.index || 0,
    url: tab.url || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || null,
    openedAt: now,
    closedAt: null,
    lastActiveAt: now,
    activeTime: 0,
    activeSince: null,
    scrollPosition: { x: 0, y: 0, percentage: 0, capturedAt: now },
    visitOrder: 0,
  });
}

export function onTabUpdated(
  tabId: number,
  _changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  if (!currentSession || !tab.url || tab.url.startsWith('chrome://')) return;
  trackTab(tabId, tab);
  persistLocally();
}

export function onTabRemoved(tabId: number): void {
  if (!currentSession) return;
  const tracked = currentSession.tabs.get(tabId);
  if (tracked) {
    tracked.closedAt = new Date().toISOString();
    flushActiveTime(tabId);
  }
  persistLocally();
}

export function onTabActivated(
  activeInfo: chrome.tabs.TabActiveInfo
): void {
  if (!currentSession) return;

  // Stop timing the previous tab
  if (activeTabId !== null) {
    flushActiveTime(activeTabId);
  }

  // Start timing the new tab
  activeTabId = activeInfo.tabId;
  const tracked = currentSession.tabs.get(activeTabId);
  if (tracked) {
    // Increment visit order for chronological tracking
    currentSession.visitCounter++;
    tracked.visitOrder = currentSession.visitCounter;

    tracked.activeSince = Date.now();
    tracked.lastActiveAt = new Date().toISOString();

    // Track context switches by domain
    try {
      const domain = new URL(tracked.url).hostname.replace('www.', '');
      currentSession.uniqueDomains.add(domain);

      if (currentSession.lastActiveDomain && currentSession.lastActiveDomain !== domain) {
        currentSession.contextSwitchCount++;

        // End deep work streak if domain changed
        if (currentSession.deepWorkStart) {
          const streakMinutes = (Date.now() - currentSession.deepWorkStart) / 60000;
          if (streakMinutes >= 5) {
            currentSession.deepWorkMinutes += Math.round(streakMinutes);
          } else {
            currentSession.shallowWorkMinutes += Math.round(streakMinutes);
          }
          currentSession.deepWorkStart = null;
        }
      }

      // Start deep work tracking on new domain
      if (!currentSession.deepWorkStart) {
        currentSession.deepWorkStart = Date.now();
      }

      currentSession.lastActiveDomain = domain;
    } catch {}
  }
  persistLocally();
}

export function onWindowFocusChanged(windowId: number): void {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (activeTabId !== null) {
      flushActiveTime(activeTabId);
      activeTabId = null;
    }
    persistLocally();
  }
}

export function updateScrollPosition(
  chromeTabId: number,
  position: ScrollPosition
): void {
  if (!currentSession) return;
  const tracked = currentSession.tabs.get(chromeTabId);
  if (tracked) {
    tracked.scrollPosition = position;
  }
}

function flushActiveTime(tabId: number): void {
  if (!currentSession) return;
  const tracked = currentSession.tabs.get(tabId);
  if (tracked?.activeSince) {
    const elapsed = Date.now() - tracked.activeSince;
    tracked.activeTime += elapsed;
    currentSession.totalActiveTime += elapsed;
    tracked.activeSince = null;
  }
}

async function persistLocally(): Promise<void> {
  if (!currentSession) return;

  const serializable = {
    ...currentSession,
    tabs: Object.fromEntries(currentSession.tabs),
    uniqueDomains: Array.from(currentSession.uniqueDomains),
  };

  await chrome.storage.local.set({
    [`session_${currentSession.id}`]: serializable,
  });
}

export async function syncToServer(): Promise<void> {
  if (!currentSession) return;

  // Flush active tab time before syncing so active time is accurate
  if (activeTabId !== null) {
    flushActiveTime(activeTabId);
    const tracked = currentSession.tabs.get(activeTabId);
    if (tracked) tracked.activeSince = Date.now();
  }

  const tabs = Array.from(currentSession.tabs.values()).map((t) => ({
    id: t.id,
    sessionId: currentSession!.id,
    url: t.url,
    title: t.title,
    favIconUrl: t.favIconUrl,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    lastActiveAt: t.lastActiveAt,
    activeTime: t.activeTime,
    scrollPosition: t.scrollPosition,
    chromeTabId: t.chromeTabId,
    windowId: t.windowId,
    index: t.index,
    visitOrder: t.visitOrder,
  }));

  await postToServer('/sessions', {
    id: currentSession.id,
    name: currentSession.name,
    createdAt: currentSession.createdAt,
    updatedAt: new Date().toISOString(),
    isActive: true,
    totalActiveTime: currentSession.totalActiveTime,
    tabs,
  });

  // Send productivity metrics
  if (currentSession.contextSwitchCount > 0 || currentSession.deepWorkMinutes > 0) {
    const now = new Date();
    await postToServer('/sessions/metrics', {
      date: now.toISOString().split('T')[0],
      hour: now.getHours(),
      contextSwitches: currentSession.contextSwitchCount,
      deepWorkMinutes: currentSession.deepWorkMinutes,
      shallowWorkMinutes: currentSession.shallowWorkMinutes,
      uniqueDomains: currentSession.uniqueDomains.size,
    });
    currentSession.contextSwitchCount = 0;
    currentSession.deepWorkMinutes = 0;
    currentSession.shallowWorkMinutes = 0;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.LAST_SYNC]: new Date().toISOString(),
  });
}

export async function saveSession(name?: string): Promise<Session | null> {
  if (!currentSession) return null;

  if (name) currentSession.name = name;

  await syncToServer();
  await persistLocally();

  return {
    id: currentSession.id,
    name: currentSession.name,
    createdAt: currentSession.createdAt,
    updatedAt: new Date().toISOString(),
    closedAt: null,
    summary: null,
    tags: [],
    taskLabels: [],
    isActive: true,
    totalActiveTime: currentSession.totalActiveTime,
    tabCount: currentSession.tabs.size,
  };
}

export function getSessionNamingInfo(): { id: string; tabCount: number; hasBeenNamed: boolean } | null {
  if (!currentSession) return null;
  return {
    id: currentSession.id,
    tabCount: currentSession.tabs.size,
    hasBeenNamed: currentSession.hasBeenNamed,
  };
}

export async function applyAIName(name: string): Promise<void> {
  if (!currentSession) return;
  currentSession.name = name;
  currentSession.hasBeenNamed = true;
  await persistLocally();
}

export function getCurrentSession(): Session | null {
  if (!currentSession) return null;
  return {
    id: currentSession.id,
    name: currentSession.name,
    createdAt: currentSession.createdAt,
    updatedAt: new Date().toISOString(),
    closedAt: null,
    summary: null,
    tags: [],
    taskLabels: [],
    isActive: true,
    totalActiveTime: currentSession.totalActiveTime,
    tabCount: currentSession.tabs.size,
  };
}

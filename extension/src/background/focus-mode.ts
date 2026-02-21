import { v4 as uuid } from 'uuid';
import { postToServer } from './server-bridge';
import type { FocusStatus } from '../shared/types';

interface FocusState {
  isActive: boolean;
  focusSessionId: string | null;
  goal: string | null;
  goalKeywords: string[];
  startedAt: number | null;
  targetDuration: number; // minutes
  focusGroupId: number | null; // Chrome tab group for focused tabs
  pausedGroupId: number | null; // Chrome tab group for paused/unrelated tabs
  focusTabIds: Set<number>;
  pausedTabIds: Set<number>;
  distractionsBlocked: number;
}

let focusState: FocusState = {
  isActive: false,
  focusSessionId: null,
  goal: null,
  goalKeywords: [],
  startedAt: null,
  targetDuration: 0,
  focusGroupId: null,
  pausedGroupId: null,
  focusTabIds: new Set(),
  pausedTabIds: new Set(),
  distractionsBlocked: 0,
};

// Common keywords mapped to related domains/terms for smarter matching
const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  ai: ['artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt', 'chatgpt', 'openai', 'anthropic', 'claude', 'huggingface', 'transformers', 'neural', 'deep learning', 'model', 'training', 'inference', 'ollama', 'qwen', 'qwq', 'mistral', 'llama', 'gemini', 'copilot', 'cursor'],
  development: ['dev', 'programming', 'coding', 'code', 'github', 'gitlab', 'stackoverflow', 'stack overflow', 'developer', 'api', 'documentation', 'docs', 'npm', 'package', 'library', 'framework', 'vscode', 'ide', 'terminal', 'debug', 'deploy', 'build'],
  design: ['figma', 'sketch', 'adobe', 'ui', 'ux', 'css', 'tailwind', 'color', 'font', 'layout', 'prototype', 'wireframe', 'dribbble', 'behance'],
  research: ['paper', 'arxiv', 'scholar', 'journal', 'study', 'analysis', 'survey', 'review', 'academic', 'university', 'wiki', 'wikipedia'],
  writing: ['docs', 'document', 'notion', 'confluence', 'google docs', 'word', 'markdown', 'blog', 'article', 'draft', 'edit'],
  shopping: ['buy', 'price', 'cart', 'shop', 'store', 'amazon', 'ebay', 'newegg', 'pcpartpicker', 'review', 'deal', 'compare'],
  hardware: ['pc', 'computer', 'ram', 'cpu', 'gpu', 'ssd', 'motherboard', 'build', 'parts', 'component', 'newegg', 'pcpartpicker', 'benchmark', 'spec'],
};

/**
 * Extract keywords from goal and expand with related terms
 */
function extractGoalKeywords(goal: string): string[] {
  const words = goal.toLowerCase().split(/\s+/);
  const keywords = new Set<string>(words);

  // Add expanded keywords
  for (const word of words) {
    // Check direct keyword expansions
    if (KEYWORD_EXPANSIONS[word]) {
      for (const expanded of KEYWORD_EXPANSIONS[word]) {
        keywords.add(expanded);
      }
    }
    // Check if the word appears in any expansion list and add that category's terms
    for (const [category, terms] of Object.entries(KEYWORD_EXPANSIONS)) {
      if (terms.includes(word)) {
        keywords.add(category);
        for (const t of terms) {
          keywords.add(t);
        }
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Check if a tab is relevant to the focus goal based on title and URL
 */
function isTabRelevantToGoal(tab: chrome.tabs.Tab, keywords: string[]): boolean {
  const title = (tab.title || '').toLowerCase();
  const url = (tab.url || '').toLowerCase();
  const combined = `${title} ${url}`;

  // Extension pages, new tab, and chrome pages are always relevant
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url === 'about:blank' ||
    url.startsWith('edge://') ||
    url === ''
  ) {
    return true;
  }

  // Check if any keyword matches the tab title or URL
  for (const keyword of keywords) {
    if (keyword.length < 2) continue; // Skip very short keywords
    if (combined.includes(keyword)) {
      return true;
    }
  }

  return false;
}

export async function startFocusMode(
  goal: string,
  durationMinutes: number,
  sessionId: string | null
): Promise<FocusStatus> {
  const id = uuid();
  const goalKeywords = extractGoalKeywords(goal);

  // Get all tabs in current window
  const currentTabs = await chrome.tabs.query({ currentWindow: true });

  const focusTabIds: number[] = [];
  const pausedTabIds: number[] = [];

  // Classify each tab as relevant or not
  for (const tab of currentTabs) {
    if (!tab.id) continue;
    if (isTabRelevantToGoal(tab, goalKeywords)) {
      focusTabIds.push(tab.id);
    } else {
      pausedTabIds.push(tab.id);
    }
  }

  // Create tab groups
  let focusGroupId: number | null = null;
  let pausedGroupId: number | null = null;

  if (focusTabIds.length > 0) {
    try {
      focusGroupId = await chrome.tabs.group({ tabIds: focusTabIds });
      await chrome.tabGroups.update(focusGroupId, {
        title: `Focus: ${goal}`,
        color: 'purple',
        collapsed: false,
      });
    } catch {
      // Tab grouping failed (might be unsupported)
    }
  }

  if (pausedTabIds.length > 0) {
    try {
      pausedGroupId = await chrome.tabs.group({ tabIds: pausedTabIds });
      await chrome.tabGroups.update(pausedGroupId, {
        title: 'Paused',
        color: 'grey',
        collapsed: true,
      });
    } catch {
      // Tab grouping failed
    }
  }

  focusState = {
    isActive: true,
    focusSessionId: id,
    goal,
    goalKeywords,
    startedAt: Date.now(),
    targetDuration: durationMinutes,
    focusGroupId,
    pausedGroupId,
    focusTabIds: new Set(focusTabIds),
    pausedTabIds: new Set(pausedTabIds),
    distractionsBlocked: 0,
  };

  // Save to chrome storage for service worker persistence
  await chrome.storage.local.set({
    focusState: {
      isActive: true,
      focusSessionId: id,
      goal,
      goalKeywords,
      startedAt: focusState.startedAt,
      targetDuration: durationMinutes,
      focusGroupId,
      pausedGroupId,
      focusTabIds,
      pausedTabIds,
      distractionsBlocked: 0,
    },
  });

  // Create focus session on server
  await postToServer('/focus', {
    id,
    sessionId,
    goal,
    targetDuration: durationMinutes,
  });

  // Set badge
  chrome.action.setBadgeText({ text: 'FOCUS' });
  chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });

  // Set alarm for focus end
  chrome.alarms.create('focus-end', { delayInMinutes: durationMinutes });
  chrome.alarms.create('focus-tick', { periodInMinutes: 1 });

  return getFocusStatus();
}

export async function endFocusMode(): Promise<{
  actualDuration: number;
  distractionsBlocked: number;
  completed: boolean;
}> {
  if (!focusState.isActive || !focusState.focusSessionId) {
    return { actualDuration: 0, distractionsBlocked: 0, completed: false };
  }

  const actualDuration = Math.round(
    (Date.now() - (focusState.startedAt || Date.now())) / 60000
  );
  const completed = actualDuration >= focusState.targetDuration;

  // Ungroup all tabs — remove from groups
  const allGroupedTabs = [
    ...Array.from(focusState.focusTabIds),
    ...Array.from(focusState.pausedTabIds),
  ];

  for (const tabId of allGroupedTabs) {
    try {
      await chrome.tabs.ungroup(tabId);
    } catch {
      // Tab may have been closed
    }
  }

  // Save to server
  await postToServer(`/focus/${focusState.focusSessionId}/end`, {
    actualDuration,
    tabsHidden: focusState.pausedTabIds.size,
    distractionsBlocked: focusState.distractionsBlocked,
    completed,
  });

  const result = {
    actualDuration,
    distractionsBlocked: focusState.distractionsBlocked,
    completed,
  };

  // Reset state
  focusState = {
    isActive: false,
    focusSessionId: null,
    goal: null,
    goalKeywords: [],
    startedAt: null,
    targetDuration: 0,
    focusGroupId: null,
    pausedGroupId: null,
    focusTabIds: new Set(),
    pausedTabIds: new Set(),
    distractionsBlocked: 0,
  };

  await chrome.storage.local.remove('focusState');
  chrome.action.setBadgeText({ text: '' });
  chrome.alarms.clear('focus-end');
  chrome.alarms.clear('focus-tick');

  return result;
}

export async function onTabCreatedDuringFocus(
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!focusState.isActive || !tab.id) return;

  // Wait briefly for the tab to load so we can check its URL/title
  setTimeout(async () => {
    try {
      const updatedTab = await chrome.tabs.get(tab.id!);

      if (isTabRelevantToGoal(updatedTab, focusState.goalKeywords)) {
        // Related tab — add to focus group
        focusState.focusTabIds.add(tab.id!);
        if (focusState.focusGroupId !== null) {
          try {
            await chrome.tabs.group({
              tabIds: tab.id!,
              groupId: focusState.focusGroupId,
            });
          } catch {}
        }
      } else {
        // Unrelated tab — count as distraction, add to paused group
        focusState.distractionsBlocked++;
        focusState.pausedTabIds.add(tab.id!);
        if (focusState.pausedGroupId !== null) {
          try {
            await chrome.tabs.group({
              tabIds: tab.id!,
              groupId: focusState.pausedGroupId,
            });
            // Keep paused group collapsed
            await chrome.tabGroups.update(focusState.pausedGroupId, {
              collapsed: true,
            });
          } catch {}
        }
      }
    } catch {
      // Tab may have been closed already
    }

    // Update badge
    const elapsed = Math.round(
      (Date.now() - (focusState.startedAt || Date.now())) / 60000
    );
    const remaining = Math.max(0, focusState.targetDuration - elapsed);
    chrome.action.setBadgeText({ text: `${remaining}m` });
  }, 1500); // Wait 1.5s for tab to load
}

export function onFocusTick(): void {
  if (!focusState.isActive || !focusState.startedAt) return;

  const elapsed = Math.round((Date.now() - focusState.startedAt) / 60000);
  const remaining = Math.max(0, focusState.targetDuration - elapsed);
  chrome.action.setBadgeText({ text: `${remaining}m` });
}

export function getFocusStatus(): FocusStatus {
  const elapsed = focusState.startedAt
    ? Math.round((Date.now() - focusState.startedAt) / 60000)
    : 0;

  return {
    isActive: focusState.isActive,
    focusSessionId: focusState.focusSessionId,
    goal: focusState.goal,
    startedAt: focusState.startedAt
      ? new Date(focusState.startedAt).toISOString()
      : null,
    targetDuration: focusState.targetDuration,
    elapsedMinutes: elapsed,
    allowedTabIds: Array.from(focusState.focusTabIds),
    distractionsBlocked: focusState.distractionsBlocked,
  };
}

export async function restoreFocusState(): Promise<void> {
  const stored = await chrome.storage.local.get('focusState');
  if (stored.focusState?.isActive) {
    const s = stored.focusState;
    focusState = {
      isActive: true,
      focusSessionId: s.focusSessionId,
      goal: s.goal,
      goalKeywords: s.goalKeywords || [],
      startedAt: s.startedAt,
      targetDuration: s.targetDuration,
      focusGroupId: s.focusGroupId || null,
      pausedGroupId: s.pausedGroupId || null,
      focusTabIds: new Set(s.focusTabIds || []),
      pausedTabIds: new Set(s.pausedTabIds || []),
      distractionsBlocked: s.distractionsBlocked || 0,
    };

    // Restore badge
    const elapsed = Math.round(
      (Date.now() - (focusState.startedAt || Date.now())) / 60000
    );
    const remaining = Math.max(0, focusState.targetDuration - elapsed);

    if (remaining <= 0) {
      await endFocusMode();
    } else {
      chrome.action.setBadgeText({ text: `${remaining}m` });
      chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' });
    }
  }
}

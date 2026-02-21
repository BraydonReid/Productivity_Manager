import { API_BASE } from '../shared/constants';

interface TabGroupResult {
  label: string;
  color: chrome.tabGroups.ColorEnum;
  tabIds: number[];
}

const COLOR_ROTATION: chrome.tabGroups.ColorEnum[] = [
  'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
];

export async function autoGroupByDomain(): Promise<TabGroupResult[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const domainMap = new Map<string, number[]>();

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    try {
      const hostname = new URL(tab.url).hostname.replace('www.', '');
      if (!hostname || hostname.startsWith('chrome') || hostname.startsWith('newtab')) continue;
      const existing = domainMap.get(hostname) || [];
      existing.push(tab.id);
      domainMap.set(hostname, existing);
    } catch {
      continue;
    }
  }

  const groups: TabGroupResult[] = [];
  let colorIndex = 0;

  for (const [domain, tabIds] of domainMap) {
    if (tabIds.length < 1) continue;
    const color = COLOR_ROTATION[colorIndex % COLOR_ROTATION.length];
    colorIndex++;
    // Shorten domain for label (remove TLD)
    const label = domain.split('.').slice(0, -1).join('.') || domain;
    groups.push({ label, color, tabIds });
  }

  // Apply groups
  for (const group of groups) {
    try {
      const groupId = await chrome.tabs.group({ tabIds: group.tabIds });
      await chrome.tabGroups.update(groupId, {
        title: group.label,
        color: group.color,
        collapsed: false,
      });
    } catch {
      // Tab grouping may fail for pinned tabs etc.
    }
  }

  return groups;
}

export async function autoGroupByAI(): Promise<TabGroupResult[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const analyzableTabs = tabs.filter(
    (t) => t.id && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
  );

  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    const res = await fetch(`${API_BASE}/ai/cluster-tabs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        tabs: analyzableTabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
        })),
      }),
    });

    if (!res.ok) {
      return autoGroupByDomain();
    }

    const { clusters } = await res.json();
    const groups: TabGroupResult[] = [];
    let colorIndex = 0;
    const validTabIds = new Set(analyzableTabs.map((t) => t.id));

    for (const cluster of clusters) {
      const tabIds = (cluster.tabIds as number[]).filter((id) => validTabIds.has(id));
      if (tabIds.length < 1) continue;

      const color = COLOR_ROTATION[colorIndex % COLOR_ROTATION.length];
      colorIndex++;
      groups.push({ label: cluster.label, color, tabIds });
    }

    for (const group of groups) {
      try {
        const groupId = await chrome.tabs.group({ tabIds: group.tabIds });
        await chrome.tabGroups.update(groupId, {
          title: group.label,
          color: group.color,
          collapsed: false,
        });
      } catch {}
    }

    return groups;
  } catch {
    return autoGroupByDomain();
  }
}

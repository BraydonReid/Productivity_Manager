import { getDb } from '../connection.js';

export interface TabRow {
  id: string;
  session_id: string;
  url: string;
  title: string;
  fav_icon_url: string | null;
  opened_at: string;
  closed_at: string | null;
  last_active_at: string | null;
  active_time: number;
  scroll_x: number;
  scroll_y: number;
  scroll_percentage: number;
  window_id: number | null;
  tab_index: number | null;
  visit_order: number;
}

export function upsertTabs(
  tabs: {
    id: string;
    sessionId: string;
    url: string;
    title: string;
    favIconUrl?: string | null;
    openedAt: string;
    closedAt?: string | null;
    lastActiveAt?: string;
    activeTime?: number;
    scrollPosition?: { x: number; y: number; percentage: number };
    windowId?: number;
    index?: number;
    visitOrder?: number;
  }[]
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tabs (id, session_id, url, title, fav_icon_url, opened_at, closed_at, last_active_at, active_time, scroll_x, scroll_y, scroll_percentage, window_id, tab_index, visit_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      fav_icon_url = COALESCE(excluded.fav_icon_url, tabs.fav_icon_url),
      closed_at = excluded.closed_at,
      last_active_at = excluded.last_active_at,
      active_time = MAX(excluded.active_time, tabs.active_time),
      scroll_x = excluded.scroll_x,
      scroll_y = excluded.scroll_y,
      scroll_percentage = excluded.scroll_percentage,
      window_id = excluded.window_id,
      tab_index = excluded.tab_index,
      visit_order = excluded.visit_order
  `);

  const upsertMany = db.transaction((tabList: typeof tabs) => {
    for (const tab of tabList) {
      stmt.run(
        tab.id,
        tab.sessionId,
        tab.url,
        tab.title,
        tab.favIconUrl || null,
        tab.openedAt,
        tab.closedAt || null,
        tab.lastActiveAt || null,
        tab.activeTime || 0,
        tab.scrollPosition?.x || 0,
        tab.scrollPosition?.y || 0,
        tab.scrollPosition?.percentage || 0,
        tab.windowId || null,
        tab.index || null,
        tab.visitOrder || 0
      );
    }
  });

  upsertMany(tabs);
}

export function getTabsBySession(sessionId: string): TabRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tabs WHERE session_id = ? ORDER BY visit_order DESC, last_active_at DESC')
    .all(sessionId) as TabRow[];

  // Deduplicate by URL: merge active times, keep most recent metadata
  const byUrl = new Map<string, TabRow>();
  for (const row of rows) {
    const existing = byUrl.get(row.url);
    if (existing) {
      existing.active_time += row.active_time;
      // Keep the version with the highest visit_order (most recently visited)
      if (row.visit_order > existing.visit_order) {
        existing.visit_order = row.visit_order;
        existing.title = row.title;
        existing.fav_icon_url = row.fav_icon_url || existing.fav_icon_url;
        existing.last_active_at = row.last_active_at;
        existing.scroll_percentage = Math.max(existing.scroll_percentage, row.scroll_percentage);
      }
    } else {
      byUrl.set(row.url, { ...row });
    }
  }

  return Array.from(byUrl.values()).sort(
    (a, b) => b.visit_order - a.visit_order || (b.last_active_at || '').localeCompare(a.last_active_at || '')
  );
}

export function updateTab(
  id: string,
  updates: Partial<{
    scrollX: number;
    scrollY: number;
    scrollPercentage: number;
    activeTime: number;
    closedAt: string;
  }>
): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.scrollX !== undefined) { sets.push('scroll_x = ?'); params.push(updates.scrollX); }
  if (updates.scrollY !== undefined) { sets.push('scroll_y = ?'); params.push(updates.scrollY); }
  if (updates.scrollPercentage !== undefined) { sets.push('scroll_percentage = ?'); params.push(updates.scrollPercentage); }
  if (updates.activeTime !== undefined) { sets.push('active_time = ?'); params.push(updates.activeTime); }
  if (updates.closedAt !== undefined) { sets.push('closed_at = ?'); params.push(updates.closedAt); }

  if (sets.length === 0) return;

  params.push(id);
  db.prepare(`UPDATE tabs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

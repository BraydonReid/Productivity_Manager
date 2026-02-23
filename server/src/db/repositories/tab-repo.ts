import { getPool } from '../connection.js';

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

export async function upsertTabs(
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
): Promise<void> {
  if (tabs.length === 0) return;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const tab of tabs) {
      await client.query(`
        INSERT INTO tabs (id, session_id, url, title, fav_icon_url, opened_at, closed_at, last_active_at, active_time, scroll_x, scroll_y, scroll_percentage, window_id, tab_index, visit_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          url = EXCLUDED.url,
          title = EXCLUDED.title,
          fav_icon_url = COALESCE(EXCLUDED.fav_icon_url, tabs.fav_icon_url),
          closed_at = EXCLUDED.closed_at,
          last_active_at = EXCLUDED.last_active_at,
          active_time = GREATEST(EXCLUDED.active_time, tabs.active_time),
          scroll_x = EXCLUDED.scroll_x,
          scroll_y = EXCLUDED.scroll_y,
          scroll_percentage = EXCLUDED.scroll_percentage,
          window_id = EXCLUDED.window_id,
          tab_index = EXCLUDED.tab_index,
          visit_order = EXCLUDED.visit_order
      `, [
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
        tab.visitOrder || 0,
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTabsBySession(sessionId: string): Promise<TabRow[]> {
  const { rows } = await getPool().query<TabRow>(
    'SELECT * FROM tabs WHERE session_id = $1 ORDER BY visit_order DESC, last_active_at DESC',
    [sessionId]
  );

  // Deduplicate by URL: merge active times, keep most recent metadata
  const byUrl = new Map<string, TabRow>();
  for (const row of rows) {
    const existing = byUrl.get(row.url);
    if (existing) {
      existing.active_time += Number(row.active_time);
      if (row.visit_order > existing.visit_order) {
        existing.visit_order = row.visit_order;
        existing.title = row.title;
        existing.fav_icon_url = row.fav_icon_url || existing.fav_icon_url;
        existing.last_active_at = row.last_active_at;
        existing.scroll_percentage = Math.max(existing.scroll_percentage, row.scroll_percentage);
      }
    } else {
      byUrl.set(row.url, { ...row, active_time: Number(row.active_time) });
    }
  }

  return Array.from(byUrl.values()).sort(
    (a, b) => b.visit_order - a.visit_order || (b.last_active_at || '').localeCompare(a.last_active_at || '')
  );
}

export async function updateTab(
  id: string,
  updates: Partial<{
    scrollX: number;
    scrollY: number;
    scrollPercentage: number;
    activeTime: number;
    closedAt: string;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.scrollX !== undefined) { sets.push(`scroll_x = $${idx++}`); params.push(updates.scrollX); }
  if (updates.scrollY !== undefined) { sets.push(`scroll_y = $${idx++}`); params.push(updates.scrollY); }
  if (updates.scrollPercentage !== undefined) { sets.push(`scroll_percentage = $${idx++}`); params.push(updates.scrollPercentage); }
  if (updates.activeTime !== undefined) { sets.push(`active_time = $${idx++}`); params.push(updates.activeTime); }
  if (updates.closedAt !== undefined) { sets.push(`closed_at = $${idx++}`); params.push(updates.closedAt); }

  if (sets.length === 0) return;

  params.push(id);
  await getPool().query(`UPDATE tabs SET ${sets.join(', ')} WHERE id = $${idx}`, params);
}

import { getDb } from '../connection.js';

export interface SessionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  summary: string | null;
  tags: string;
  is_active: number;
  total_active_time: number;
}

export function upsertSession(session: {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  summary?: string | null;
  tags?: string[];
  isActive?: boolean;
  totalActiveTime?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (id, user_id, name, created_at, updated_at, closed_at, summary, tags, is_active, total_active_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at,
      closed_at = excluded.closed_at,
      summary = COALESCE(excluded.summary, sessions.summary),
      tags = excluded.tags,
      is_active = excluded.is_active,
      total_active_time = excluded.total_active_time
  `).run(
    session.id,
    session.userId,
    session.name,
    session.createdAt,
    session.updatedAt,
    session.closedAt || null,
    session.summary || null,
    JSON.stringify(session.tags || []),
    session.isActive !== false ? 1 : 0,
    session.totalActiveTime || 0
  );
}

export function getSession(id: string, userId: string): SessionRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(id, userId) as SessionRow | undefined;
}

export function listSessions(options: {
  userId: string;
  limit?: number;
  offset?: number;
  active?: boolean;
  sort?: string;
}): SessionRow[] {
  const db = getDb();
  let sql = 'SELECT * FROM sessions WHERE user_id = ?';
  const params: unknown[] = [options.userId];

  if (options.active !== undefined) {
    sql += ' AND is_active = ?';
    params.push(options.active ? 1 : 0);
  }

  sql += ` ORDER BY ${options.sort === 'createdAt' ? 'created_at' : 'updated_at'} DESC`;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(options.limit || 50, options.offset || 0);

  return db.prepare(sql).all(...params) as SessionRow[];
}

export function updateSessionSummary(id: string, summary: string, userId: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET summary = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(summary, new Date().toISOString(), id, userId);
}

export function updateSessionName(id: string, name: string, userId: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(name, new Date().toISOString(), id, userId);
}

export function updateSessionTags(id: string, tags: string[], userId: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET tags = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(JSON.stringify(tags), new Date().toISOString(), id, userId);
}

export function deleteSession(id: string, userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, userId);
}

export function getSessionAnalytics(userId: string): {
  totalSessions: number;
  totalTabs: number;
  totalNotes: number;
  totalActiveTime: number;
  topDomains: { domain: string; visits: number; totalTime: number }[];
  sessionsRestored: number;
} {
  const db = getDb();

  const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?').get(userId) as { count: number }).count;
  const totalTabs = (db.prepare('SELECT COUNT(*) as count FROM tabs JOIN sessions ON tabs.session_id = sessions.id WHERE sessions.user_id = ?').get(userId) as { count: number }).count;
  const totalNotes = (db.prepare('SELECT COUNT(*) as count FROM notes JOIN sessions ON notes.session_id = sessions.id WHERE sessions.user_id = ?').get(userId) as { count: number }).count;
  const totalActiveTime = (db.prepare('SELECT COALESCE(SUM(total_active_time), 0) as total FROM sessions WHERE user_id = ?').get(userId) as { total: number }).total;
  const sessionsRestored = (db.prepare('SELECT COALESCE(SUM(sessions_restored), 0) as total FROM productivity_metrics WHERE user_id = ?').get(userId) as { total: number }).total;

  const topDomains = db.prepare(`
    SELECT
      REPLACE(REPLACE(REPLACE(tabs.url, 'https://', ''), 'http://', ''), 'www.', '') as full_url,
      COUNT(*) as visits,
      COALESCE(SUM(tabs.active_time), 0) as total_time
    FROM tabs
    JOIN sessions ON tabs.session_id = sessions.id
    WHERE sessions.user_id = ?
    GROUP BY SUBSTR(full_url, 1, INSTR(full_url || '/', '/') - 1)
    ORDER BY visits DESC
    LIMIT 15
  `).all(userId) as { full_url: string; visits: number; total_time: number }[];

  return {
    totalSessions,
    totalTabs,
    totalNotes,
    totalActiveTime,
    sessionsRestored,
    topDomains: topDomains.map((d) => ({
      domain: d.full_url.split('/')[0],
      visits: d.visits,
      totalTime: d.total_time,
    })),
  };
}

export function getProductivityMetrics(from: string, to: string, userId: string): {
  date: string;
  hour: number;
  contextSwitches: number;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  uniqueDomains: number;
  sessionsRestored: number;
}[] {
  const db = getDb();
  return (db.prepare(`
    SELECT * FROM productivity_metrics
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date, hour
  `).all(userId, from, to) as any[]).map((r) => ({
    date: r.date,
    hour: r.hour,
    contextSwitches: r.context_switches,
    deepWorkMinutes: r.deep_work_minutes,
    shallowWorkMinutes: r.shallow_work_minutes,
    uniqueDomains: r.unique_domains,
    sessionsRestored: r.sessions_restored,
  }));
}

export function upsertProductivityMetric(data: {
  userId: string;
  date: string;
  hour: number;
  contextSwitches?: number;
  deepWorkMinutes?: number;
  shallowWorkMinutes?: number;
  uniqueDomains?: number;
  sessionsRestored?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO productivity_metrics (user_id, date, hour, context_switches, deep_work_minutes, shallow_work_minutes, unique_domains, sessions_restored)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date, hour) DO UPDATE SET
      context_switches = context_switches + COALESCE(excluded.context_switches, 0),
      deep_work_minutes = deep_work_minutes + COALESCE(excluded.deep_work_minutes, 0),
      shallow_work_minutes = shallow_work_minutes + COALESCE(excluded.shallow_work_minutes, 0),
      unique_domains = MAX(unique_domains, COALESCE(excluded.unique_domains, 0)),
      sessions_restored = sessions_restored + COALESCE(excluded.sessions_restored, 0)
  `).run(
    data.userId,
    data.date,
    data.hour,
    data.contextSwitches || 0,
    data.deepWorkMinutes || 0,
    data.shallowWorkMinutes || 0,
    data.uniqueDomains || 0,
    data.sessionsRestored || 0
  );
}

export function getDomainCategories(): { domain: string; category: string; isUserSet: boolean }[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM domain_categories ORDER BY domain').all() as any[]).map((r) => ({
    domain: r.domain,
    category: r.category,
    isUserSet: Boolean(r.is_user_set),
  }));
}

export function setDomainCategory(domain: string, category: string, isUserSet = true): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO domain_categories (domain, category, is_user_set)
    VALUES (?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET category = excluded.category, is_user_set = excluded.is_user_set
  `).run(domain, category, isUserSet ? 1 : 0);
}

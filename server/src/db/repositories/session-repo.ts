import { getPool } from '../connection.js';

export interface SessionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  summary: string | null;
  tags: string;
  is_active: boolean;
  total_active_time: number;
}

export async function upsertSession(session: {
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
}): Promise<void> {
  await getPool().query(`
    INSERT INTO sessions (id, user_id, name, created_at, updated_at, closed_at, summary, tags, is_active, total_active_time)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = EXCLUDED.updated_at,
      closed_at = EXCLUDED.closed_at,
      summary = COALESCE(EXCLUDED.summary, sessions.summary),
      tags = EXCLUDED.tags,
      is_active = EXCLUDED.is_active,
      total_active_time = GREATEST(EXCLUDED.total_active_time, sessions.total_active_time)
  `, [
    session.id,
    session.userId,
    session.name,
    session.createdAt,
    session.updatedAt,
    session.closedAt || null,
    session.summary || null,
    JSON.stringify(session.tags || []),
    session.isActive !== false,
    session.totalActiveTime || 0,
  ]);
}

export async function getSession(id: string, userId: string): Promise<SessionRow | undefined> {
  const { rows } = await getPool().query<SessionRow>(
    'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0];
}

export async function listSessions(options: {
  userId: string;
  limit?: number;
  offset?: number;
  active?: boolean;
  sort?: string;
}): Promise<SessionRow[]> {
  const params: unknown[] = [options.userId];
  let idx = 2;
  let sql = 'SELECT * FROM sessions WHERE user_id = $1';

  if (options.active !== undefined) {
    sql += ` AND is_active = $${idx++}`;
    params.push(options.active);
  }

  sql += ` ORDER BY ${options.sort === 'createdAt' ? 'created_at' : 'updated_at'} DESC`;
  sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(options.limit || 50, options.offset || 0);

  const { rows } = await getPool().query<SessionRow>(sql, params);
  return rows;
}

export async function updateSessionSummary(id: string, summary: string, userId: string): Promise<void> {
  await getPool().query(
    'UPDATE sessions SET summary = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
    [summary, new Date().toISOString(), id, userId]
  );
}

export async function updateSessionName(id: string, name: string, userId: string): Promise<void> {
  await getPool().query(
    'UPDATE sessions SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
    [name, new Date().toISOString(), id, userId]
  );
}

export async function updateSessionTags(id: string, tags: string[], userId: string): Promise<void> {
  await getPool().query(
    'UPDATE sessions SET tags = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
    [JSON.stringify(tags), new Date().toISOString(), id, userId]
  );
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  await getPool().query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function getSessionAnalytics(userId: string): Promise<{
  totalSessions: number;
  totalTabs: number;
  totalNotes: number;
  totalActiveTime: number;
  topDomains: { domain: string; visits: number; totalTime: number }[];
  sessionsRestored: number;
}> {
  const pool = getPool();

  const [s, t, n, at, sr, td] = await Promise.all([
    pool.query<{ count: string }>('SELECT COUNT(*) as count FROM sessions WHERE user_id = $1', [userId]),
    pool.query<{ count: string }>('SELECT COUNT(*) as count FROM tabs JOIN sessions ON tabs.session_id = sessions.id WHERE sessions.user_id = $1', [userId]),
    pool.query<{ count: string }>('SELECT COUNT(*) as count FROM notes JOIN sessions ON notes.session_id = sessions.id WHERE sessions.user_id = $1', [userId]),
    pool.query<{ total: string }>('SELECT COALESCE(SUM(total_active_time), 0) as total FROM sessions WHERE user_id = $1', [userId]),
    pool.query<{ total: string }>('SELECT COALESCE(SUM(sessions_restored), 0) as total FROM productivity_metrics WHERE user_id = $1', [userId]),
    pool.query<{ domain: string; visits: string; total_time: string }>(`
      SELECT
        SPLIT_PART(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(tabs.url, '^https?://', ''), '^www\\.', ''), '/.*$', ''), '/', 1) as domain,
        COUNT(*) as visits,
        COALESCE(SUM(tabs.active_time), 0) as total_time
      FROM tabs
      JOIN sessions ON tabs.session_id = sessions.id
      WHERE sessions.user_id = $1
      GROUP BY domain
      ORDER BY visits DESC
      LIMIT 15
    `, [userId]),
  ]);

  return {
    totalSessions: parseInt(s.rows[0].count, 10),
    totalTabs: parseInt(t.rows[0].count, 10),
    totalNotes: parseInt(n.rows[0].count, 10),
    totalActiveTime: parseInt(at.rows[0].total, 10),
    sessionsRestored: parseInt(sr.rows[0].total, 10),
    topDomains: td.rows.map((d) => ({
      domain: d.domain,
      visits: parseInt(d.visits as unknown as string, 10),
      totalTime: parseInt(d.total_time as unknown as string, 10),
    })),
  };
}

export async function getProductivityMetrics(from: string, to: string, userId: string): Promise<{
  date: string;
  hour: number;
  contextSwitches: number;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  uniqueDomains: number;
  sessionsRestored: number;
}[]> {
  const { rows } = await getPool().query(`
    SELECT * FROM productivity_metrics
    WHERE user_id = $1 AND date >= $2 AND date <= $3
    ORDER BY date, hour
  `, [userId, from, to]);

  return (rows as any[]).map((r) => ({
    date: r.date,
    hour: r.hour,
    contextSwitches: r.context_switches,
    deepWorkMinutes: r.deep_work_minutes,
    shallowWorkMinutes: r.shallow_work_minutes,
    uniqueDomains: r.unique_domains,
    sessionsRestored: r.sessions_restored,
  }));
}

export async function upsertProductivityMetric(data: {
  userId: string;
  date: string;
  hour: number;
  contextSwitches?: number;
  deepWorkMinutes?: number;
  shallowWorkMinutes?: number;
  uniqueDomains?: number;
  sessionsRestored?: number;
}): Promise<void> {
  await getPool().query(`
    INSERT INTO productivity_metrics (user_id, date, hour, context_switches, deep_work_minutes, shallow_work_minutes, unique_domains, sessions_restored)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id, date, hour) DO UPDATE SET
      context_switches = productivity_metrics.context_switches + COALESCE(EXCLUDED.context_switches, 0),
      deep_work_minutes = productivity_metrics.deep_work_minutes + COALESCE(EXCLUDED.deep_work_minutes, 0),
      shallow_work_minutes = productivity_metrics.shallow_work_minutes + COALESCE(EXCLUDED.shallow_work_minutes, 0),
      unique_domains = GREATEST(productivity_metrics.unique_domains, COALESCE(EXCLUDED.unique_domains, 0)),
      sessions_restored = productivity_metrics.sessions_restored + COALESCE(EXCLUDED.sessions_restored, 0)
  `, [
    data.userId,
    data.date,
    data.hour,
    data.contextSwitches || 0,
    data.deepWorkMinutes || 0,
    data.shallowWorkMinutes || 0,
    data.uniqueDomains || 0,
    data.sessionsRestored || 0,
  ]);
}

export async function getDomainCategories(): Promise<{ domain: string; category: string; isUserSet: boolean }[]> {
  const { rows } = await getPool().query('SELECT * FROM domain_categories ORDER BY domain');
  return (rows as any[]).map((r) => ({
    domain: r.domain,
    category: r.category,
    isUserSet: Boolean(r.is_user_set),
  }));
}

export async function setDomainCategory(domain: string, category: string, isUserSet = true): Promise<void> {
  await getPool().query(`
    INSERT INTO domain_categories (domain, category, is_user_set)
    VALUES ($1, $2, $3)
    ON CONFLICT (domain) DO UPDATE SET category = EXCLUDED.category, is_user_set = EXCLUDED.is_user_set
  `, [domain, category, isUserSet]);
}

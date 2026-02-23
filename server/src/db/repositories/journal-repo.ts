import { getPool } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface JournalRow {
  id: string;
  user_id: string;
  date: string;
  summary: string | null;
  tasks_completed: string;
  time_breakdown: string;
  key_decisions: string;
  total_sessions: number;
  total_active_time: number;
  total_tabs: number;
  total_notes: number;
  generated_at: string | null;
}

export async function getJournal(date: string, userId: string): Promise<JournalRow | undefined> {
  const { rows } = await getPool().query<JournalRow>(
    'SELECT * FROM daily_journals WHERE user_id = $1 AND date = $2',
    [userId, date]
  );
  return rows[0];
}

export async function listJournals(from: string | undefined, to: string | undefined, userId: string): Promise<JournalRow[]> {
  const params: string[] = [userId];
  let idx = 2;
  let sql = 'SELECT * FROM daily_journals WHERE user_id = $1';

  if (from && to) {
    sql += ` AND date >= $${idx++} AND date <= $${idx++}`;
    params.push(from, to);
  } else if (from) {
    sql += ` AND date >= $${idx++}`;
    params.push(from);
  } else if (to) {
    sql += ` AND date <= $${idx++}`;
    params.push(to);
  }

  sql += ' ORDER BY date DESC';
  const { rows } = await getPool().query<JournalRow>(sql, params);
  return rows;
}

export async function upsertJournal(journal: {
  userId: string;
  date: string;
  summary: string | null;
  tasksCompleted: unknown[];
  timeBreakdown: Record<string, number>;
  keyDecisions: string[];
  totalSessions: number;
  totalActiveTime: number;
  totalTabs: number;
  totalNotes: number;
}): Promise<void> {
  await getPool().query(`
    INSERT INTO daily_journals (id, user_id, date, summary, tasks_completed, time_breakdown, key_decisions, total_sessions, total_active_time, total_tabs, total_notes, generated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (user_id, date) DO UPDATE SET
      summary = EXCLUDED.summary,
      tasks_completed = EXCLUDED.tasks_completed,
      time_breakdown = EXCLUDED.time_breakdown,
      key_decisions = EXCLUDED.key_decisions,
      total_sessions = EXCLUDED.total_sessions,
      total_active_time = EXCLUDED.total_active_time,
      total_tabs = EXCLUDED.total_tabs,
      total_notes = EXCLUDED.total_notes,
      generated_at = EXCLUDED.generated_at
  `, [
    uuidv4(),
    journal.userId,
    journal.date,
    journal.summary,
    JSON.stringify(journal.tasksCompleted),
    JSON.stringify(journal.timeBreakdown),
    JSON.stringify(journal.keyDecisions),
    journal.totalSessions,
    journal.totalActiveTime,
    journal.totalTabs,
    journal.totalNotes,
    new Date().toISOString(),
  ]);
}

export interface DaySessionDetail {
  id: string;
  name: string;
  total_active_time: number;
  created_at: string;
  updated_at: string;
  summary: string | null;
  tabs: {
    url: string;
    title: string;
    active_time: number;
    visit_order: number;
    opened_at: string;
    last_active_at: string | null;
    scroll_percentage: number;
  }[];
  notes: { content: string; created_at: string; url: string | null }[];
  clipboardEntries: { content: string; content_type: string; captured_at: string }[];
}

export interface DayFocusSession {
  id: string;
  session_id: string | null;
  goal: string;
  target_duration: number;
  started_at: string;
  ended_at: string | null;
  actual_duration: number;
  distractions_blocked: number;
  completed: boolean;
}

export async function getDaySessionData(date: string, userId: string): Promise<{
  sessions: { id: string; name: string; total_active_time: number; created_at: string }[];
  tabs: { url: string; title: string; active_time: number; session_id: string }[];
  notes: { content: string; created_at: string }[];
  clipboardEntries: { content: string; content_type: string }[];
}> {
  const nextDate = new Date(date + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  const pool = getPool();
  const { rows: sessions } = await pool.query<any>(`
    SELECT id, name, total_active_time, created_at FROM sessions
    WHERE user_id = $1 AND created_at::date >= $2::date AND created_at::date < $3::date
    ORDER BY created_at
  `, [userId, date, nextDateStr]);

  const sessionIds: string[] = sessions.map((s: any) => s.id);
  if (sessionIds.length === 0) return { sessions: [], tabs: [], notes: [], clipboardEntries: [] };

  const [tabsRes, notesRes, clipboardRes] = await Promise.all([
    pool.query<any>('SELECT url, title, active_time, session_id FROM tabs WHERE session_id = ANY($1) ORDER BY active_time DESC', [sessionIds]),
    pool.query<any>('SELECT content, created_at FROM notes WHERE session_id = ANY($1) ORDER BY created_at', [sessionIds]),
    pool.query<any>('SELECT content, content_type FROM clipboard_entries WHERE session_id = ANY($1) ORDER BY captured_at', [sessionIds]),
  ]);

  return { sessions, tabs: tabsRes.rows, notes: notesRes.rows, clipboardEntries: clipboardRes.rows };
}

export async function getDayDetailedData(date: string, userId: string): Promise<{
  sessions: DaySessionDetail[];
  focusSessions: DayFocusSession[];
}> {
  const nextDate = new Date(date + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  const pool = getPool();
  const { rows: sessions } = await pool.query<any>(`
    SELECT id, name, total_active_time, created_at, updated_at, summary FROM sessions
    WHERE user_id = $1 AND created_at::date >= $2::date AND created_at::date < $3::date
    ORDER BY created_at
  `, [userId, date, nextDateStr]);

  const sessionIds: string[] = sessions.map((s: any) => s.id);

  const result: DaySessionDetail[] = sessions.map((s: any) => ({
    id: s.id,
    name: s.name,
    total_active_time: s.total_active_time,
    created_at: s.created_at,
    updated_at: s.updated_at,
    summary: s.summary,
    tabs: [],
    notes: [],
    clipboardEntries: [],
  }));

  if (sessionIds.length > 0) {
    const [tabsRes, notesRes, clipboardRes] = await Promise.all([
      pool.query<any>('SELECT url, title, active_time, session_id, visit_order, opened_at, last_active_at, scroll_percentage FROM tabs WHERE session_id = ANY($1) ORDER BY visit_order DESC, last_active_at DESC', [sessionIds]),
      pool.query<any>('SELECT content, created_at, url, session_id FROM notes WHERE session_id = ANY($1) ORDER BY created_at', [sessionIds]),
      pool.query<any>('SELECT content, content_type, captured_at, session_id FROM clipboard_entries WHERE session_id = ANY($1) ORDER BY captured_at', [sessionIds]),
    ]);

    const sessionMap = new Map<string, DaySessionDetail>();
    for (const s of result) sessionMap.set(s.id, s);

    for (const t of tabsRes.rows) {
      sessionMap.get(t.session_id)?.tabs.push({ url: t.url, title: t.title, active_time: t.active_time, visit_order: t.visit_order, opened_at: t.opened_at, last_active_at: t.last_active_at, scroll_percentage: t.scroll_percentage });
    }
    for (const n of notesRes.rows) {
      sessionMap.get(n.session_id)?.notes.push({ content: n.content, created_at: n.created_at, url: n.url });
    }
    for (const c of clipboardRes.rows) {
      sessionMap.get(c.session_id)?.clipboardEntries.push({ content: c.content, content_type: c.content_type, captured_at: c.captured_at });
    }
  }

  const { rows: focusSessions } = await pool.query<DayFocusSession>(`
    SELECT id, session_id, goal, target_duration, started_at, ended_at,
           actual_duration, distractions_blocked, completed
    FROM focus_sessions
    WHERE user_id = $1 AND started_at::date >= $2::date AND started_at::date < $3::date
    ORDER BY started_at
  `, [userId, date, nextDateStr]);

  return { sessions: result, focusSessions };
}

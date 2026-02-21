import { getDb } from '../connection.js';
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

export function getJournal(date: string, userId: string): JournalRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM daily_journals WHERE user_id = ? AND date = ?').get(userId, date) as JournalRow | undefined;
}

export function listJournals(from: string | undefined, to: string | undefined, userId: string): JournalRow[] {
  const db = getDb();
  let sql = 'SELECT * FROM daily_journals WHERE user_id = ?';
  const params: string[] = [userId];

  if (from && to) {
    sql += ' AND date >= ? AND date <= ?';
    params.push(from, to);
  } else if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  } else if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY date DESC';
  return db.prepare(sql).all(...params) as JournalRow[];
}

export function upsertJournal(journal: {
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
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO daily_journals (id, user_id, date, summary, tasks_completed, time_breakdown, key_decisions, total_sessions, total_active_time, total_tabs, total_notes, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      summary = excluded.summary,
      tasks_completed = excluded.tasks_completed,
      time_breakdown = excluded.time_breakdown,
      key_decisions = excluded.key_decisions,
      total_sessions = excluded.total_sessions,
      total_active_time = excluded.total_active_time,
      total_tabs = excluded.total_tabs,
      total_notes = excluded.total_notes,
      generated_at = excluded.generated_at
  `).run(
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
    new Date().toISOString()
  );
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
  notes: {
    content: string;
    created_at: string;
    url: string | null;
  }[];
  clipboardEntries: {
    content: string;
    content_type: string;
    captured_at: string;
  }[];
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
  completed: number;
}

export function getDaySessionData(date: string, userId: string): {
  sessions: { id: string; name: string; total_active_time: number; created_at: string }[];
  tabs: { url: string; title: string; active_time: number; session_id: string }[];
  notes: { content: string; created_at: string }[];
  clipboardEntries: { content: string; content_type: string }[];
} {
  const db = getDb();
  const nextDate = new Date(date + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  const sessions = db.prepare(`
    SELECT id, name, total_active_time, created_at FROM sessions
    WHERE user_id = ? AND date(created_at) >= ? AND date(created_at) < ?
    ORDER BY created_at
  `).all(userId, date, nextDateStr) as any[];

  const sessionIds = sessions.map((s: any) => s.id);
  if (sessionIds.length === 0) {
    return { sessions: [], tabs: [], notes: [], clipboardEntries: [] };
  }

  const placeholders = sessionIds.map(() => '?').join(',');

  const tabs = db.prepare(`
    SELECT url, title, active_time, session_id FROM tabs
    WHERE session_id IN (${placeholders})
    ORDER BY active_time DESC
  `).all(...sessionIds) as any[];

  const notes = db.prepare(`
    SELECT content, created_at FROM notes
    WHERE session_id IN (${placeholders})
    ORDER BY created_at
  `).all(...sessionIds) as any[];

  const clipboardEntries = db.prepare(`
    SELECT content, content_type FROM clipboard_entries
    WHERE session_id IN (${placeholders})
    ORDER BY captured_at
  `).all(...sessionIds) as any[];

  return { sessions, tabs, notes, clipboardEntries };
}

export function getDayDetailedData(date: string, userId: string): {
  sessions: DaySessionDetail[];
  focusSessions: DayFocusSession[];
} {
  const db = getDb();
  const nextDate = new Date(date + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  const sessions = db.prepare(`
    SELECT id, name, total_active_time, created_at, updated_at, summary FROM sessions
    WHERE user_id = ? AND date(created_at) >= ? AND date(created_at) < ?
    ORDER BY created_at
  `).all(userId, date, nextDateStr) as any[];

  const sessionIds = sessions.map((s: any) => s.id);

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
    const placeholders = sessionIds.map(() => '?').join(',');

    const tabs = db.prepare(`
      SELECT url, title, active_time, session_id, visit_order, opened_at, last_active_at, scroll_percentage
      FROM tabs
      WHERE session_id IN (${placeholders})
      ORDER BY visit_order DESC, last_active_at DESC
    `).all(...sessionIds) as any[];

    const notes = db.prepare(`
      SELECT content, created_at, url, session_id FROM notes
      WHERE session_id IN (${placeholders})
      ORDER BY created_at
    `).all(...sessionIds) as any[];

    const clipboard = db.prepare(`
      SELECT content, content_type, captured_at, session_id FROM clipboard_entries
      WHERE session_id IN (${placeholders})
      ORDER BY captured_at
    `).all(...sessionIds) as any[];

    const sessionMap = new Map<string, DaySessionDetail>();
    for (const s of result) sessionMap.set(s.id, s);

    for (const t of tabs) {
      sessionMap.get(t.session_id)?.tabs.push({
        url: t.url,
        title: t.title,
        active_time: t.active_time,
        visit_order: t.visit_order,
        opened_at: t.opened_at,
        last_active_at: t.last_active_at,
        scroll_percentage: t.scroll_percentage,
      });
    }

    for (const n of notes) {
      sessionMap.get(n.session_id)?.notes.push({
        content: n.content,
        created_at: n.created_at,
        url: n.url,
      });
    }

    for (const c of clipboard) {
      sessionMap.get(c.session_id)?.clipboardEntries.push({
        content: c.content,
        content_type: c.content_type,
        captured_at: c.captured_at,
      });
    }
  }

  const focusSessions = db.prepare(`
    SELECT id, session_id, goal, target_duration, started_at, ended_at,
           actual_duration, distractions_blocked, completed
    FROM focus_sessions
    WHERE user_id = ? AND date(started_at) >= ? AND date(started_at) < ?
    ORDER BY started_at
  `).all(userId, date, nextDateStr) as DayFocusSession[];

  return { sessions: result, focusSessions };
}

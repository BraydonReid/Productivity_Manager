import { getDb } from '../connection.js';

export interface FocusSessionRow {
  id: string;
  user_id: string;
  session_id: string | null;
  goal: string;
  target_duration: number;
  started_at: string;
  ended_at: string | null;
  actual_duration: number;
  tabs_hidden: number;
  distractions_blocked: number;
  completed: number;
}

export function createFocusSession(entry: {
  id: string;
  userId: string;
  sessionId: string | null;
  goal: string;
  targetDuration: number;
  startedAt: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO focus_sessions (id, user_id, session_id, goal, target_duration, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.userId, entry.sessionId, entry.goal, entry.targetDuration, entry.startedAt);
}

export function endFocusSession(id: string, data: {
  endedAt: string;
  actualDuration: number;
  tabsHidden: number;
  distractionsBlocked: number;
  completed: boolean;
}): void {
  const db = getDb();
  db.prepare(`
    UPDATE focus_sessions SET
      ended_at = ?, actual_duration = ?, tabs_hidden = ?,
      distractions_blocked = ?, completed = ?
    WHERE id = ?
  `).run(data.endedAt, data.actualDuration, data.tabsHidden, data.distractionsBlocked, data.completed ? 1 : 0, id);
}

export function getActiveFocusSession(userId: string): FocusSessionRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(userId) as FocusSessionRow | undefined;
}

export function listFocusSessions(limit = 20, userId: string): FocusSessionRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?')
    .all(userId, limit) as FocusSessionRow[];
}

export function getFocusStats(userId: string): {
  totalSessions: number;
  totalFocusMinutes: number;
  avgDuration: number;
  completionRate: number;
  totalDistractionsBlocked: number;
} {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(actual_duration), 0) as total_minutes,
      COALESCE(AVG(actual_duration), 0) as avg_duration,
      COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as completion_rate,
      COALESCE(SUM(distractions_blocked), 0) as total_distractions
    FROM focus_sessions WHERE user_id = ? AND ended_at IS NOT NULL
  `).get(userId) as any;

  return {
    totalSessions: row.total,
    totalFocusMinutes: row.total_minutes,
    avgDuration: Math.round(row.avg_duration),
    completionRate: Math.round(row.completion_rate),
    totalDistractionsBlocked: row.total_distractions,
  };
}

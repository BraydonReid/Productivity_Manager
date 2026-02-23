import { getPool } from '../connection.js';

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
  completed: boolean;
}

export async function createFocusSession(entry: {
  id: string;
  userId: string;
  sessionId: string | null;
  goal: string;
  targetDuration: number;
  startedAt: string;
}): Promise<void> {
  await getPool().query(
    'INSERT INTO focus_sessions (id, user_id, session_id, goal, target_duration, started_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [entry.id, entry.userId, entry.sessionId, entry.goal, entry.targetDuration, entry.startedAt]
  );
}

export async function endFocusSession(id: string, data: {
  endedAt: string;
  actualDuration: number;
  tabsHidden: number;
  distractionsBlocked: number;
  completed: boolean;
}): Promise<void> {
  await getPool().query(
    'UPDATE focus_sessions SET ended_at = $1, actual_duration = $2, tabs_hidden = $3, distractions_blocked = $4, completed = $5 WHERE id = $6',
    [data.endedAt, data.actualDuration, data.tabsHidden, data.distractionsBlocked, data.completed, id]
  );
}

export async function getActiveFocusSession(userId: string): Promise<FocusSessionRow | undefined> {
  const { rows } = await getPool().query<FocusSessionRow>(
    'SELECT * FROM focus_sessions WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
    [userId]
  );
  return rows[0];
}

export async function listFocusSessions(limit = 20, userId: string): Promise<FocusSessionRow[]> {
  const { rows } = await getPool().query<FocusSessionRow>(
    'SELECT * FROM focus_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2',
    [userId, limit]
  );
  return rows;
}

export async function getFocusStats(userId: string): Promise<{
  totalSessions: number;
  totalFocusMinutes: number;
  avgDuration: number;
  completionRate: number;
  totalDistractionsBlocked: number;
}> {
  const { rows } = await getPool().query(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(actual_duration), 0) as total_minutes,
      COALESCE(AVG(actual_duration), 0) as avg_duration,
      COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as completion_rate,
      COALESCE(SUM(distractions_blocked), 0) as total_distractions
    FROM focus_sessions WHERE user_id = $1 AND ended_at IS NOT NULL
  `, [userId]);

  const row = rows[0] as any;
  return {
    totalSessions: parseInt(row.total, 10),
    totalFocusMinutes: parseInt(row.total_minutes, 10),
    avgDuration: Math.round(parseFloat(row.avg_duration)),
    completionRate: Math.round(parseFloat(row.completion_rate)),
    totalDistractionsBlocked: parseInt(row.total_distractions, 10),
  };
}

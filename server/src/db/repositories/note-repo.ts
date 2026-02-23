import { getPool } from '../connection.js';

export interface NoteRow {
  id: string;
  session_id: string | null;
  tab_id: string | null;
  url: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function createNote(note: {
  id: string;
  sessionId: string | null;
  tabId?: string | null;
  url?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  await getPool().query(
    'INSERT INTO notes (id, session_id, tab_id, url, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [note.id, note.sessionId, note.tabId || null, note.url || null, note.content, note.createdAt, note.updatedAt]
  );
}

export async function getNotes(filters: { sessionId?: string; url?: string }): Promise<NoteRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.sessionId) { conditions.push(`session_id = $${idx++}`); params.push(filters.sessionId); }
  if (filters.url) { conditions.push(`url = $${idx++}`); params.push(filters.url); }

  let sql = 'SELECT * FROM notes';
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const { rows } = await getPool().query<NoteRow>(sql, params);
  return rows;
}

export async function updateNote(id: string, content: string): Promise<void> {
  await getPool().query(
    'UPDATE notes SET content = $1, updated_at = $2 WHERE id = $3',
    [content, new Date().toISOString(), id]
  );
}

export async function deleteNote(id: string): Promise<void> {
  await getPool().query('DELETE FROM notes WHERE id = $1', [id]);
}

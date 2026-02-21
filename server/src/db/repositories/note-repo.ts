import { getDb } from '../connection.js';

export interface NoteRow {
  id: string;
  session_id: string | null;
  tab_id: string | null;
  url: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export function createNote(note: {
  id: string;
  sessionId: string | null;
  tabId?: string | null;
  url?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO notes (id, session_id, tab_id, url, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.sessionId,
    note.tabId || null,
    note.url || null,
    note.content,
    note.createdAt,
    note.updatedAt
  );
}

export function getNotes(filters: {
  sessionId?: string;
  url?: string;
}): NoteRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.sessionId) {
    conditions.push('session_id = ?');
    params.push(filters.sessionId);
  }
  if (filters.url) {
    conditions.push('url = ?');
    params.push(filters.url);
  }

  let sql = 'SELECT * FROM notes';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params) as NoteRow[];
}

export function updateNote(id: string, content: string): void {
  const db = getDb();
  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
    .run(content, new Date().toISOString(), id);
}

export function deleteNote(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

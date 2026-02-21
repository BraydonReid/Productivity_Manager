import { getDb } from '../connection.js';

export interface ClipboardRow {
  id: string;
  session_id: string;
  content: string;
  summary: string | null;
  source_url: string | null;
  captured_at: string;
  content_type: string;
}

export function createClipboardEntry(entry: {
  id: string;
  sessionId: string;
  content: string;
  summary?: string | null;
  sourceUrl?: string | null;
  capturedAt: string;
  contentType?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO clipboard_entries (id, session_id, content, summary, source_url, captured_at, content_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.sessionId,
    entry.content,
    entry.summary || null,
    entry.sourceUrl || null,
    entry.capturedAt,
    entry.contentType || 'text'
  );
}

export function getClipboardEntries(filters: {
  sessionId?: string;
  limit?: number;
}): ClipboardRow[] {
  const db = getDb();
  let sql = 'SELECT * FROM clipboard_entries';
  const params: unknown[] = [];

  if (filters.sessionId) {
    sql += ' WHERE session_id = ?';
    params.push(filters.sessionId);
  }

  sql += ' ORDER BY captured_at DESC';
  sql += ' LIMIT ?';
  params.push(filters.limit || 50);

  return db.prepare(sql).all(...params) as ClipboardRow[];
}

export function updateClipboardSummary(id: string, summary: string): void {
  const db = getDb();
  db.prepare('UPDATE clipboard_entries SET summary = ? WHERE id = ?').run(summary, id);
}

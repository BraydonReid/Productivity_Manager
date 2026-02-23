import { getPool } from '../connection.js';

export interface ClipboardRow {
  id: string;
  session_id: string;
  content: string;
  summary: string | null;
  source_url: string | null;
  captured_at: string;
  content_type: string;
}

export async function createClipboardEntry(entry: {
  id: string;
  sessionId: string;
  content: string;
  summary?: string | null;
  sourceUrl?: string | null;
  capturedAt: string;
  contentType?: string;
}): Promise<void> {
  await getPool().query(
    'INSERT INTO clipboard_entries (id, session_id, content, summary, source_url, captured_at, content_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [entry.id, entry.sessionId, entry.content, entry.summary || null, entry.sourceUrl || null, entry.capturedAt, entry.contentType || 'text']
  );
}

export async function getClipboardEntries(filters: { sessionId?: string; limit?: number }): Promise<ClipboardRow[]> {
  let sql = 'SELECT * FROM clipboard_entries';
  const params: unknown[] = [];
  let idx = 1;

  if (filters.sessionId) {
    sql += ` WHERE session_id = $${idx++}`;
    params.push(filters.sessionId);
  }

  sql += ' ORDER BY captured_at DESC';
  sql += ` LIMIT $${idx}`;
  params.push(filters.limit || 50);

  const { rows } = await getPool().query<ClipboardRow>(sql, params);
  return rows;
}

export async function updateClipboardSummary(id: string, summary: string): Promise<void> {
  await getPool().query('UPDATE clipboard_entries SET summary = $1 WHERE id = $2', [summary, id]);
}

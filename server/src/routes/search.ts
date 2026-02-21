import { Router } from 'express';
import { searchSessions } from '../services/search-service.js';
import { getDb } from '../db/connection.js';

const router = Router();

// Universal search with filters
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const query = req.query.q as string;
  const mode = (req.query.mode as 'fulltext' | 'semantic' | 'hybrid') || 'hybrid';
  const contentType = req.query.type as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const domain = req.query.domain as string | undefined;

  if (!query) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  try {
    const results: any[] = [];

    // Session search (always included unless filtered)
    if (!contentType || contentType === 'all' || contentType === 'sessions') {
      const sessionResults = await searchSessions(query, mode, userId);
      for (const r of sessionResults) {
        results.push({ ...r, resultType: 'session' });
      }
    }

    const db = getDb();

    // Tab search
    if (!contentType || contentType === 'all' || contentType === 'tabs') {
      try {
        let tabSql = `
          SELECT t.id, t.url, t.title, t.active_time, t.session_id,
                 s.name as session_name, s.created_at as session_date
          FROM tabs_fts fts
          JOIN tabs t ON t.rowid = fts.rowid
          JOIN sessions s ON s.id = t.session_id
          WHERE tabs_fts MATCH ? AND s.user_id = ?
        `;
        const tabParams: any[] = [query, userId];

        if (from) { tabSql += ' AND s.created_at >= ?'; tabParams.push(from); }
        if (to) { tabSql += ' AND s.created_at <= ?'; tabParams.push(to); }
        if (domain) { tabSql += ' AND t.url LIKE ?'; tabParams.push(`%${domain}%`); }

        tabSql += ' ORDER BY rank LIMIT 20';

        const tabs = db.prepare(tabSql).all(...tabParams) as any[];
        for (const t of tabs) {
          results.push({
            resultType: 'tab',
            id: t.id,
            sessionId: t.session_id,
            sessionName: t.session_name,
            sessionDate: t.session_date,
            url: t.url,
            title: t.title,
            activeTime: t.active_time,
          });
        }
      } catch {}
    }

    // Note search
    if (!contentType || contentType === 'all' || contentType === 'notes') {
      try {
        let noteSql = `
          SELECT n.id, n.content, n.url, n.session_id, n.created_at,
                 s.name as session_name
          FROM notes_fts fts
          JOIN notes n ON n.rowid = fts.rowid
          LEFT JOIN sessions s ON s.id = n.session_id
          WHERE notes_fts MATCH ? AND (s.user_id = ? OR s.id IS NULL)
        `;
        const noteParams: any[] = [query, userId];

        if (from) { noteSql += ' AND n.created_at >= ?'; noteParams.push(from); }
        if (to) { noteSql += ' AND n.created_at <= ?'; noteParams.push(to); }

        noteSql += ' ORDER BY rank LIMIT 20';

        const notes = db.prepare(noteSql).all(...noteParams) as any[];
        for (const n of notes) {
          results.push({
            resultType: 'note',
            id: n.id,
            sessionId: n.session_id,
            sessionName: n.session_name,
            content: n.content.substring(0, 300),
            url: n.url,
            createdAt: n.created_at,
          });
        }
      } catch {}
    }

    // Clipboard search
    if (!contentType || contentType === 'all' || contentType === 'clipboard') {
      try {
        let clipSql = `
          SELECT c.id, c.content, c.source_url, c.session_id, c.captured_at, c.content_type,
                 s.name as session_name
          FROM clipboard_fts fts
          JOIN clipboard_entries c ON c.rowid = fts.rowid
          JOIN sessions s ON s.id = c.session_id
          WHERE clipboard_fts MATCH ? AND s.user_id = ?
        `;
        const clipParams: any[] = [query, userId];

        if (from) { clipSql += ' AND c.captured_at >= ?'; clipParams.push(from); }
        if (to) { clipSql += ' AND c.captured_at <= ?'; clipParams.push(to); }

        clipSql += ' ORDER BY rank LIMIT 20';

        const clips = db.prepare(clipSql).all(...clipParams) as any[];
        for (const c of clips) {
          results.push({
            resultType: 'clipboard',
            id: c.id,
            sessionId: c.session_id,
            sessionName: c.session_name,
            content: c.content.substring(0, 300),
            sourceUrl: c.source_url,
            capturedAt: c.captured_at,
            contentType: c.content_type,
          });
        }
      } catch {}
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

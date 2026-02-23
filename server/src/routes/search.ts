import { Router } from 'express';
import { searchSessions } from '../services/search-service.js';
import { getPool } from '../db/connection.js';

const router = Router();

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
    const pool = getPool();

    if (!contentType || contentType === 'all' || contentType === 'sessions') {
      const sessionResults = await searchSessions(query, mode, userId);
      for (const r of sessionResults) {
        results.push({ ...r, resultType: 'session' });
      }
    }

    if (!contentType || contentType === 'all' || contentType === 'tabs') {
      try {
        const params: any[] = [query, userId];
        let idx = 3;
        let extra = '';
        if (from) { extra += ` AND s.created_at >= $${idx++}`; params.push(from); }
        if (to) { extra += ` AND s.created_at <= $${idx++}`; params.push(to); }
        if (domain) { extra += ` AND t.url ILIKE $${idx++}`; params.push(`%${domain}%`); }

        const { rows: tabs } = await pool.query<any>(`
          SELECT t.id, t.url, t.title, t.active_time, t.session_id,
                 s.name as session_name, s.created_at as session_date,
                 ts_rank(to_tsvector('english', coalesce(t.url,'') || ' ' || coalesce(t.title,'')), plainto_tsquery('english', $1)) as rank
          FROM tabs t
          JOIN sessions s ON s.id = t.session_id
          WHERE to_tsvector('english', coalesce(t.url,'') || ' ' || coalesce(t.title,'')) @@ plainto_tsquery('english', $1)
            AND s.user_id = $2 ${extra}
          ORDER BY rank DESC LIMIT 20
        `, params);

        for (const t of tabs) {
          results.push({ resultType: 'tab', id: t.id, sessionId: t.session_id, sessionName: t.session_name, sessionDate: t.session_date, url: t.url, title: t.title, activeTime: t.active_time });
        }
      } catch {}
    }

    if (!contentType || contentType === 'all' || contentType === 'notes') {
      try {
        const params: any[] = [query, userId];
        let idx = 3;
        let extra = '';
        if (from) { extra += ` AND n.created_at >= $${idx++}`; params.push(from); }
        if (to) { extra += ` AND n.created_at <= $${idx++}`; params.push(to); }

        const { rows: notes } = await pool.query<any>(`
          SELECT n.id, n.content, n.url, n.session_id, n.created_at, s.name as session_name
          FROM notes n
          LEFT JOIN sessions s ON s.id = n.session_id
          WHERE to_tsvector('english', coalesce(n.content,'')) @@ plainto_tsquery('english', $1)
            AND (s.user_id = $2 OR s.id IS NULL) ${extra}
          ORDER BY ts_rank(to_tsvector('english', coalesce(n.content,'')), plainto_tsquery('english', $1)) DESC
          LIMIT 20
        `, params);

        for (const n of notes) {
          results.push({ resultType: 'note', id: n.id, sessionId: n.session_id, sessionName: n.session_name, content: n.content.substring(0, 300), url: n.url, createdAt: n.created_at });
        }
      } catch {}
    }

    if (!contentType || contentType === 'all' || contentType === 'clipboard') {
      try {
        const params: any[] = [query, userId];
        let idx = 3;
        let extra = '';
        if (from) { extra += ` AND c.captured_at >= $${idx++}`; params.push(from); }
        if (to) { extra += ` AND c.captured_at <= $${idx++}`; params.push(to); }

        const { rows: clips } = await pool.query<any>(`
          SELECT c.id, c.content, c.source_url, c.session_id, c.captured_at, c.content_type, s.name as session_name
          FROM clipboard_entries c
          JOIN sessions s ON s.id = c.session_id
          WHERE to_tsvector('english', coalesce(c.content,'')) @@ plainto_tsquery('english', $1)
            AND s.user_id = $2 ${extra}
          ORDER BY ts_rank(to_tsvector('english', coalesce(c.content,'')), plainto_tsquery('english', $1)) DESC
          LIMIT 20
        `, params);

        for (const c of clips) {
          results.push({ resultType: 'clipboard', id: c.id, sessionId: c.session_id, sessionName: c.session_name, content: c.content.substring(0, 300), sourceUrl: c.source_url, capturedAt: c.captured_at, contentType: c.content_type });
        }
      } catch {}
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

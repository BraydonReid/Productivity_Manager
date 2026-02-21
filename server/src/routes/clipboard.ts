import { Router } from 'express';
import { createClipboardEntry, getClipboardEntries } from '../db/repositories/clipboard-repo.js';

const router = Router();

router.get('/', (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const entries = getClipboardEntries({ sessionId, limit }).map((c) => ({
    id: c.id,
    sessionId: c.session_id,
    content: c.content,
    summary: c.summary,
    sourceUrl: c.source_url,
    capturedAt: c.captured_at,
    contentType: c.content_type,
  }));
  res.json(entries);
});

router.post('/', (req, res) => {
  createClipboardEntry(req.body);
  res.json({ success: true });
});

export default router;

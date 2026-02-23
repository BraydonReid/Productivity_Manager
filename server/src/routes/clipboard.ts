import { Router } from 'express';
import { createClipboardEntry, getClipboardEntries } from '../db/repositories/clipboard-repo.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = (await getClipboardEntries({ sessionId, limit })).map((c) => ({
      id: c.id,
      sessionId: c.session_id,
      content: c.content,
      summary: c.summary,
      sourceUrl: c.source_url,
      capturedAt: c.captured_at,
      contentType: c.content_type,
    }));
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    await createClipboardEntry(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

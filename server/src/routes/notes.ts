import { Router } from 'express';
import { createNote, getNotes, updateNote, deleteNote } from '../db/repositories/note-repo.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string | undefined;
    const url = req.query.url as string | undefined;
    const notes = (await getNotes({ sessionId, url })).map((n) => ({
      id: n.id,
      sessionId: n.session_id,
      tabId: n.tab_id,
      url: n.url,
      content: n.content,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    await createNote(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await updateNote(req.params.id, req.body.content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteNote(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

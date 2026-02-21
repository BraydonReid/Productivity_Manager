import { Router } from 'express';
import { createNote, getNotes, updateNote, deleteNote } from '../db/repositories/note-repo.js';

const router = Router();

router.get('/', (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  const url = req.query.url as string | undefined;
  const notes = getNotes({ sessionId, url }).map((n) => ({
    id: n.id,
    sessionId: n.session_id,
    tabId: n.tab_id,
    url: n.url,
    content: n.content,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));
  res.json(notes);
});

router.post('/', (req, res) => {
  createNote(req.body);
  res.json({ success: true });
});

router.put('/:id', (req, res) => {
  updateNote(req.params.id, req.body.content);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  deleteNote(req.params.id);
  res.json({ success: true });
});

export default router;

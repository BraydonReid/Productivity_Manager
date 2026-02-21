import { Router } from 'express';
import { upsertTabs, updateTab } from '../db/repositories/tab-repo.js';

const router = Router();

// Batch upsert tabs for a session
router.post('/sessions/:sessionId/tabs', (req, res) => {
  const tabs = req.body.tabs || req.body;
  if (!Array.isArray(tabs)) {
    res.status(400).json({ error: 'Expected array of tabs' });
    return;
  }
  upsertTabs(tabs.map((t: any) => ({ ...t, sessionId: req.params.sessionId })));
  res.json({ success: true });
});

// Update single tab
router.put('/:id', (req, res) => {
  updateTab(req.params.id, req.body);
  res.json({ success: true });
});

export default router;

import { Router } from 'express';
import { upsertTabs, updateTab } from '../db/repositories/tab-repo.js';

const router = Router();

router.post('/sessions/:sessionId/tabs', async (req, res) => {
  try {
    const tabs = req.body.tabs || req.body;
    if (!Array.isArray(tabs)) {
      res.status(400).json({ error: 'Expected array of tabs' });
      return;
    }
    await upsertTabs(tabs.map((t: any) => ({ ...t, sessionId: req.params.sessionId })));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await updateTab(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

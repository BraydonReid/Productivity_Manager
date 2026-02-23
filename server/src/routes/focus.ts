import { Router } from 'express';
import {
  createFocusSession,
  endFocusSession,
  getActiveFocusSession,
  listFocusSessions,
  getFocusStats,
} from '../db/repositories/focus-repo.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const sessions = (await listFocusSessions(limit, userId)).map(formatFocusSession);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await getFocusStats(req.user!.userId));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const active = await getActiveFocusSession(req.user!.userId);
    res.json(active ? formatFocusSession(active) : null);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id, sessionId, goal, targetDuration } = req.body;
    await createFocusSession({
      id,
      userId,
      sessionId: sessionId || null,
      goal,
      targetDuration,
      startedAt: new Date().toISOString(),
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:id/end', async (req, res) => {
  try {
    const { actualDuration, tabsHidden, distractionsBlocked, completed } = req.body;
    await endFocusSession(req.params.id, {
      endedAt: new Date().toISOString(),
      actualDuration: actualDuration || 0,
      tabsHidden: tabsHidden || 0,
      distractionsBlocked: distractionsBlocked || 0,
      completed: completed || false,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

function formatFocusSession(f: any) {
  return {
    id: f.id,
    sessionId: f.session_id,
    goal: f.goal,
    targetDuration: f.target_duration,
    startedAt: f.started_at,
    endedAt: f.ended_at,
    actualDuration: f.actual_duration,
    tabsHidden: f.tabs_hidden,
    distractionsBlocked: f.distractions_blocked,
    completed: Boolean(f.completed),
  };
}

export default router;

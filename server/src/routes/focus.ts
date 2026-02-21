import { Router } from 'express';
import {
  createFocusSession,
  endFocusSession,
  getActiveFocusSession,
  listFocusSessions,
  getFocusStats,
} from '../db/repositories/focus-repo.js';

const router = Router();

// List focus sessions
router.get('/', (req, res) => {
  const userId = req.user!.userId;
  const limit = parseInt(req.query.limit as string) || 20;
  const sessions = listFocusSessions(limit, userId).map(formatFocusSession);
  res.json(sessions);
});

// Get focus stats
router.get('/stats', (req, res) => {
  res.json(getFocusStats(req.user!.userId));
});

// Get active focus session
router.get('/active', (req, res) => {
  const active = getActiveFocusSession(req.user!.userId);
  res.json(active ? formatFocusSession(active) : null);
});

// Start a focus session
router.post('/', (req, res) => {
  const userId = req.user!.userId;
  const { id, sessionId, goal, targetDuration } = req.body;
  createFocusSession({
    id,
    userId,
    sessionId: sessionId || null,
    goal,
    targetDuration,
    startedAt: new Date().toISOString(),
  });
  res.json({ success: true, id });
});

// End a focus session
router.post('/:id/end', (req, res) => {
  const { actualDuration, tabsHidden, distractionsBlocked, completed } = req.body;
  endFocusSession(req.params.id, {
    endedAt: new Date().toISOString(),
    actualDuration: actualDuration || 0,
    tabsHidden: tabsHidden || 0,
    distractionsBlocked: distractionsBlocked || 0,
    completed: completed || false,
  });
  res.json({ success: true });
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

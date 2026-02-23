import { Router } from 'express';
import { getJournal, listJournals, getDayDetailedData } from '../db/repositories/journal-repo.js';
import { generateDailyJournal } from '../services/journal-service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const journals = (await listJournals(from, to, userId)).map(formatJournal);
    res.json(journals);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:date/detail', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = await getDayDetailedData(req.params.date, userId);
    res.json({
      sessions: data.sessions.map((s) => ({
        id: s.id,
        name: s.name,
        totalActiveTime: s.total_active_time,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        summary: s.summary,
        tabs: s.tabs.map((t) => ({
          url: t.url,
          title: t.title,
          activeTime: t.active_time,
          visitOrder: t.visit_order,
          openedAt: t.opened_at,
          lastActiveAt: t.last_active_at,
          scrollPercentage: t.scroll_percentage,
        })),
        notes: s.notes.map((n) => ({ content: n.content, createdAt: n.created_at, url: n.url })),
        clipboardEntries: s.clipboardEntries.map((c) => ({ content: c.content, contentType: c.content_type, capturedAt: c.captured_at })),
      })),
      focusSessions: data.focusSessions.map((f) => ({
        id: f.id,
        sessionId: f.session_id,
        goal: f.goal,
        targetDuration: f.target_duration,
        startedAt: f.started_at,
        endedAt: f.ended_at,
        actualDuration: f.actual_duration,
        distractionsBlocked: f.distractions_blocked,
        completed: Boolean(f.completed),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:date', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const journal = await getJournal(req.params.date, userId);
    if (!journal) { res.json(null); return; }
    res.json(formatJournal(journal));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:date/generate', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await generateDailyJournal(req.params.date, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

function formatJournal(j: any) {
  return {
    date: j.date,
    summary: j.summary,
    tasksCompleted: JSON.parse(j.tasks_completed),
    timeBreakdown: JSON.parse(j.time_breakdown),
    keyDecisions: JSON.parse(j.key_decisions),
    totalSessions: j.total_sessions,
    totalActiveTime: j.total_active_time,
    totalTabs: j.total_tabs,
    totalNotes: j.total_notes,
    generatedAt: j.generated_at,
  };
}

export default router;

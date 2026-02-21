import { Router } from 'express';
import {
  upsertSession,
  getSession,
  listSessions,
  updateSessionSummary,
  updateSessionName,
  deleteSession,
  getSessionAnalytics,
  getProductivityMetrics,
  getDomainCategories,
  setDomainCategory,
  upsertProductivityMetric,
} from '../db/repositories/session-repo.js';
import { upsertTabs, getTabsBySession } from '../db/repositories/tab-repo.js';
import { getNotes } from '../db/repositories/note-repo.js';
import { getClipboardEntries } from '../db/repositories/clipboard-repo.js';

const router = Router();

// List sessions
router.get('/', (req, res) => {
  const userId = req.user!.userId;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const sort = (req.query.sort as string) || 'updatedAt';
  const active = req.query.active !== undefined
    ? req.query.active === 'true'
    : undefined;

  const sessions = listSessions({ userId, limit, offset, active, sort });

  const formatted = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    closedAt: s.closed_at,
    summary: s.summary,
    tags: JSON.parse(s.tags),
    isActive: Boolean(s.is_active),
    totalActiveTime: s.total_active_time,
    tabCount: 0,
    taskLabels: [],
  }));

  res.json(formatted);
});

// Analytics — MUST be before /:id to avoid route conflict
router.get('/analytics', (req, res) => {
  const data = getSessionAnalytics(req.user!.userId);
  res.json(data);
});

// Productivity metrics — MUST be before /:id
router.get('/metrics', (req, res) => {
  const userId = req.user!.userId;
  const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
  const to = (req.query.to as string) || from;
  const metrics = getProductivityMetrics(from, to, userId);
  res.json(metrics);
});

// Domain categories — MUST be before /:id
router.get('/domains', (_req, res) => {
  res.json(getDomainCategories());
});

// Get session detail
router.get('/:id', (req, res) => {
  const userId = req.user!.userId;
  const session = getSession(req.params.id, userId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const tabs = getTabsBySession(session.id).map((t) => ({
    id: t.id,
    sessionId: t.session_id,
    url: t.url,
    title: t.title,
    favIconUrl: t.fav_icon_url,
    openedAt: t.opened_at,
    closedAt: t.closed_at,
    lastActiveAt: t.last_active_at,
    activeTime: t.active_time,
    scrollPosition: {
      x: t.scroll_x,
      y: t.scroll_y,
      percentage: t.scroll_percentage,
      capturedAt: t.last_active_at || t.opened_at,
    },
    windowId: t.window_id,
    index: t.tab_index,
  }));

  const notes = getNotes({ sessionId: session.id }).map((n) => ({
    id: n.id,
    sessionId: n.session_id,
    tabId: n.tab_id,
    url: n.url,
    content: n.content,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const clipboardEntries = getClipboardEntries({ sessionId: session.id }).map((c) => ({
    id: c.id,
    sessionId: c.session_id,
    content: c.content,
    summary: c.summary,
    sourceUrl: c.source_url,
    capturedAt: c.captured_at,
    contentType: c.content_type,
  }));

  res.json({
    id: session.id,
    name: session.name,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    closedAt: session.closed_at,
    summary: session.summary,
    tags: JSON.parse(session.tags),
    isActive: Boolean(session.is_active),
    totalActiveTime: session.total_active_time,
    tabCount: tabs.length,
    taskLabels: [],
    tabs,
    notes,
    clipboardEntries,
  });
});

// Create/update session (upsert with tabs)
router.post('/', (req, res) => {
  const userId = req.user!.userId;
  const { id, name, createdAt, updatedAt, isActive, totalActiveTime, tabs, closedAt, summary, tags } = req.body;

  upsertSession({
    id,
    userId,
    name,
    createdAt,
    updatedAt: updatedAt || new Date().toISOString(),
    closedAt,
    summary,
    tags,
    isActive,
    totalActiveTime,
  });

  if (tabs && Array.isArray(tabs)) {
    upsertTabs(tabs);
  }

  res.json({ success: true });
});

// Update session
router.put('/:id', (req, res) => {
  const userId = req.user!.userId;
  const { name, summary } = req.body;
  if (name) updateSessionName(req.params.id, name, userId);
  if (summary) updateSessionSummary(req.params.id, summary, userId);
  res.json({ success: true });
});

// Delete session
router.delete('/:id', (req, res) => {
  deleteSession(req.params.id, req.user!.userId);
  res.json({ success: true });
});

// Restore session (returns tabs to reopen)
router.post('/:id/restore', (req, res) => {
  const userId = req.user!.userId;
  const session = getSession(req.params.id, userId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const tabs = getTabsBySession(session.id).map((t) => ({
    id: t.id,
    url: t.url,
    title: t.title,
    scrollPosition: {
      x: t.scroll_x,
      y: t.scroll_y,
      percentage: t.scroll_percentage,
    },
  }));

  res.json({ session: { id: session.id, name: session.name }, tabs });
});

// Record productivity metrics (from extension)
router.post('/metrics', (req, res) => {
  upsertProductivityMetric({ ...req.body, userId: req.user!.userId });
  res.json({ success: true });
});

router.put('/domains/:domain', (req, res) => {
  setDomainCategory(req.params.domain, req.body.category, true);
  res.json({ success: true });
});

export default router;

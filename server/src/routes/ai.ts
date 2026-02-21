import { Router } from 'express';
import { getSession } from '../db/repositories/session-repo.js';
import { getTabsBySession } from '../db/repositories/tab-repo.js';
import { getNotes } from '../db/repositories/note-repo.js';
import { updateSessionSummary, updateSessionName, updateSessionTags } from '../db/repositories/session-repo.js';
import { updateClipboardSummary, getClipboardEntries } from '../db/repositories/clipboard-repo.js';
import {
  summarizeSession,
  generateSessionName,
  detectTasks,
  summarizeClipboard,
  generateEmbedding,
  generateNextSteps,
  analyzePageContent,
  chatWithPage,
  clusterTabs,
} from '../services/ai-service.js';
import { getDb } from '../db/connection.js';
import { serializeVector } from '../services/search-service.js';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

const router = Router();

// Summarize a session
router.post('/summarize-session', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;
    const session = getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const tabs = getTabsBySession(sessionId);
    const notes = getNotes({ sessionId });

    const summary = await summarizeSession({
      name: session.name,
      tabs: tabs.map((t) => ({
        url: t.url,
        title: t.title,
        activeTime: t.active_time,
      })),
      notes: notes.map((n) => ({ content: n.content })),
      totalActiveTime: session.total_active_time,
    });

    updateSessionSummary(sessionId, summary, userId);

    // Generate embedding for the session
    const textForEmbedding = `${session.name} ${summary} ${tabs.map((t) => t.title).join(' ')}`;
    try {
      const embedding = await generateEmbedding(textForEmbedding);
      const db = getDb();
      const textHash = createHash('md5').update(textForEmbedding).digest('hex');
      db.prepare(`
        INSERT INTO embeddings (id, entity_type, entity_id, vector, text_hash, created_at)
        VALUES (?, 'session', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET vector = excluded.vector, text_hash = excluded.text_hash
      `).run(uuid(), sessionId, serializeVector(embedding), textHash, new Date().toISOString());
    } catch {
      // Embedding generation is optional
    }

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Generate session name
router.post('/name-session', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;
    const tabs = getTabsBySession(sessionId);
    const name = await generateSessionName(
      tabs.map((t) => ({ url: t.url, title: t.title }))
    );
    updateSessionName(sessionId, name, userId);
    res.json({ name });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Detect tasks
router.post('/detect-tasks', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;
    const tabs = getTabsBySession(sessionId);
    const tasks = await detectTasks(
      tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        activeTime: t.active_time,
      }))
    );

    // Save task labels
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO task_labels (id, session_id, label, confidence, associated_tab_ids, detected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const task of tasks) {
      stmt.run(uuid(), sessionId, task.label, task.confidence, JSON.stringify(task.tabIds), now);
    }

    // Update session tags
    const tags = tasks.map((t) => t.label);
    updateSessionTags(sessionId, tags, userId);

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Generate next steps for a session
router.post('/next-steps', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;
    const session = getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const tabs = getTabsBySession(sessionId);
    const notes = getNotes({ sessionId });
    const clipboard = getClipboardEntries({ sessionId });

    const steps = await generateNextSteps({
      name: session.name,
      tabs: tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        activeTime: t.active_time,
        scrollPercentage: t.scroll_percentage,
      })),
      notes: notes.map((n) => ({ content: n.content })),
      clipboardEntries: clipboard.map((c) => ({
        content: c.content,
        contentType: c.content_type,
      })),
      summary: session.summary,
    });

    // Save next steps
    const db = getDb();
    const now = new Date().toISOString();
    // Clear old steps for this session
    db.prepare('DELETE FROM next_steps WHERE session_id = ?').run(sessionId);

    const stmt = db.prepare(`
      INSERT INTO next_steps (id, session_id, step, reasoning, related_tab_ids, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const step of steps) {
      stmt.run(uuid(), sessionId, step.step, step.reasoning, JSON.stringify(step.relatedTabIds || []), now);
    }

    res.json({ steps });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get saved next steps for a session
router.get('/next-steps/:sessionId', (req, res) => {
  const db = getDb();
  const steps = db.prepare(
    'SELECT * FROM next_steps WHERE session_id = ? ORDER BY generated_at DESC'
  ).all(req.params.sessionId) as any[];

  res.json(steps.map((s: any) => ({
    id: s.id,
    sessionId: s.session_id,
    step: s.step,
    reasoning: s.reasoning,
    relatedTabIds: JSON.parse(s.related_tab_ids),
    isCompleted: Boolean(s.is_completed),
    generatedAt: s.generated_at,
  })));
});

// Toggle next step completion
router.put('/next-steps/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE next_steps SET is_completed = NOT is_completed WHERE id = ?')
    .run(req.params.id);
  res.json({ success: true });
});

// Analyze a webpage's content and return key notes
router.post('/analyze-page', async (req, res) => {
  try {
    const { title, url, content } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Page content is required' });
      return;
    }

    const notes = await analyzePageContent({ title, url, content });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Chat with a webpage — ask questions about its content
router.post('/chat-page', async (req, res) => {
  try {
    const { title, url, content, question, history } = req.body;
    if (!content || !question) {
      res.status(400).json({ error: 'Page content and question are required' });
      return;
    }

    const answer = await chatWithPage({
      title,
      url,
      content,
      question,
      history: history || [],
    });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Cluster tabs by AI-detected task/topic
router.post('/cluster-tabs', async (req, res) => {
  try {
    const { tabs } = req.body;
    if (!tabs?.length) {
      res.status(400).json({ error: 'Tabs array is required' });
      return;
    }
    const clusters = await clusterTabs(tabs);
    res.json({ clusters });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Summarize clipboard entry
router.post('/summarize-clipboard', async (req, res) => {
  try {
    const { clipboardEntryId } = req.body;
    const entries = getClipboardEntries({});
    const entry = entries.find((e) => e.id === clipboardEntryId);
    if (!entry) {
      res.status(404).json({ error: 'Clipboard entry not found' });
      return;
    }

    const summary = await summarizeClipboard(entry.content);
    updateClipboardSummary(clipboardEntryId, summary);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

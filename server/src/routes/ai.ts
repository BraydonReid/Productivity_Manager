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
import { getPool } from '../db/connection.js';
import { serializeVector } from '../services/search-service.js';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

const router = Router();

// Summarize a session
router.post('/summarize-session', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;
    const session = await getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const [tabs, notes, clipboard] = await Promise.all([
      getTabsBySession(sessionId),
      getNotes({ sessionId }),
      getClipboardEntries({ sessionId }),
    ]);

    const summary = await summarizeSession({
      name: session.name,
      tabs: tabs.map((t) => ({
        url: t.url,
        title: t.title,
        activeTime: t.active_time,
        scrollPercentage: t.scroll_percentage,
      })),
      notes: notes.map((n) => ({ content: n.content })),
      clipboardEntries: clipboard.map((c) => ({ content: c.content, contentType: c.content_type })),
      totalActiveTime: session.total_active_time,
    });

    await updateSessionSummary(sessionId, summary, userId);

    // Generate embedding for the session (optional)
    const textForEmbedding = `${session.name} ${summary} ${tabs.map((t) => t.title).join(' ')}`;
    try {
      const embedding = await generateEmbedding(textForEmbedding);
      const pool = getPool();
      const textHash = createHash('md5').update(textForEmbedding).digest('hex');
      await pool.query(`
        INSERT INTO embeddings (id, entity_type, entity_id, vector, text_hash, created_at)
        VALUES ($1, 'session', $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET vector = EXCLUDED.vector, text_hash = EXCLUDED.text_hash
      `, [uuid(), sessionId, serializeVector(embedding), textHash, new Date().toISOString()]);
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
    const tabs = await getTabsBySession(sessionId);
    const name = await generateSessionName(
      tabs.map((t) => ({ url: t.url, title: t.title }))
    );
    await updateSessionName(sessionId, name, userId);
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
    const tabs = await getTabsBySession(sessionId);
    const tasks = await detectTasks(
      tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        activeTime: t.active_time,
      }))
    );

    // Save task labels
    const pool = getPool();
    const now = new Date().toISOString();
    for (const task of tasks) {
      await pool.query(`
        INSERT INTO task_labels (id, session_id, label, confidence, associated_tab_ids, detected_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuid(), sessionId, task.label, task.confidence, JSON.stringify(task.tabIds), now]);
    }

    // Update session tags
    const tags = tasks.map((t) => t.label);
    await updateSessionTags(sessionId, tags, userId);

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
    const session = await getSession(sessionId, userId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const [tabs, notes, clipboard] = await Promise.all([
      getTabsBySession(sessionId),
      getNotes({ sessionId }),
      getClipboardEntries({ sessionId }),
    ]);

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

    // Save next steps — clear old ones first
    const pool = getPool();
    const now = new Date().toISOString();
    await pool.query('DELETE FROM next_steps WHERE session_id = $1', [sessionId]);

    for (const step of steps) {
      await pool.query(`
        INSERT INTO next_steps (id, session_id, step, reasoning, related_tab_ids, generated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuid(), sessionId, step.step, step.reasoning, JSON.stringify(step.relatedTabIds || []), now]);
    }

    res.json({ steps });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get saved next steps for a session
router.get('/next-steps/:sessionId', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM next_steps WHERE session_id = $1 ORDER BY generated_at DESC',
      [req.params.sessionId]
    );
    res.json(rows.map((s: any) => ({
      id: s.id,
      sessionId: s.session_id,
      step: s.step,
      reasoning: s.reasoning,
      relatedTabIds: JSON.parse(s.related_tab_ids),
      isCompleted: Boolean(s.is_completed),
      generatedAt: s.generated_at,
    })));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Toggle next step completion
router.put('/next-steps/:id/toggle', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('UPDATE next_steps SET is_completed = NOT is_completed WHERE id = $1', [req.params.id]);
    const { rows } = await pool.query('SELECT * FROM next_steps WHERE id = $1', [req.params.id]);
    const step = rows[0];
    if (!step) { res.status(404).json({ error: 'Step not found' }); return; }
    res.json({
      id: step.id,
      sessionId: step.session_id,
      step: step.step,
      reasoning: step.reasoning,
      relatedTabIds: JSON.parse(step.related_tab_ids),
      isCompleted: Boolean(step.is_completed),
      generatedAt: step.generated_at,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
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
    const entries = await getClipboardEntries({});
    const entry = entries.find((e) => e.id === clipboardEntryId);
    if (!entry) {
      res.status(404).json({ error: 'Clipboard entry not found' });
      return;
    }

    const summary = await summarizeClipboard(entry.content);
    await updateClipboardSummary(clipboardEntryId, summary);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

import express from 'express';
import { config } from './config.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { aiRateLimiter } from './middleware/rate-limiter.js';
import { initDb, closeDb } from './db/connection.js';

import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import tabsRouter from './routes/tabs.js';
import notesRouter from './routes/notes.js';
import clipboardRouter from './routes/clipboard.js';
import aiRouter from './routes/ai.js';
import searchRouter from './routes/search.js';
import journalRouter from './routes/journal.js';
import focusRouter from './routes/focus.js';

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '5mb' }));

// Public routes
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protect all other /api/* routes
app.use('/api', authMiddleware);

// Protected routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/tabs', tabsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/clipboard', clipboardRouter);
app.use('/api/ai', aiRateLimiter, aiRouter);
app.use('/api/search', searchRouter);
app.use('/api/journal', journalRouter);
app.use('/api/focus', focusRouter);

// Error handler
app.use(errorHandler);

// Initialize database and start server
(async () => {
  await initDb();

  const server = app.listen(config.port, () => {
    console.log(`Session Memory server running on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    console.log('\nShutting down...');
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  summary TEXT,
  tags TEXT DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  total_active_time BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tabs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  fav_icon_url TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  last_active_at TEXT,
  active_time BIGINT DEFAULT 0,
  scroll_x DOUBLE PRECISION DEFAULT 0,
  scroll_y DOUBLE PRECISION DEFAULT 0,
  scroll_percentage DOUBLE PRECISION DEFAULT 0,
  window_id INTEGER,
  tab_index INTEGER,
  visit_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  tab_id TEXT REFERENCES tabs(id) ON DELETE SET NULL,
  url TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clipboard_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  captured_at TEXT NOT NULL,
  content_type TEXT DEFAULT 'text'
);

CREATE TABLE IF NOT EXISTS task_labels (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  confidence DOUBLE PRECISION DEFAULT 0.0,
  associated_tab_ids TEXT DEFAULT '[]',
  detected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  vector TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_journals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  summary TEXT,
  tasks_completed TEXT DEFAULT '[]',
  time_breakdown TEXT DEFAULT '{}',
  key_decisions TEXT DEFAULT '[]',
  total_sessions INTEGER DEFAULT 0,
  total_active_time BIGINT DEFAULT 0,
  total_tabs INTEGER DEFAULT 0,
  total_notes INTEGER DEFAULT 0,
  generated_at TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS next_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  reasoning TEXT,
  related_tab_ids TEXT DEFAULT '[]',
  is_completed BOOLEAN DEFAULT FALSE,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  session_id TEXT REFERENCES sessions(id),
  goal TEXT NOT NULL,
  target_duration INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  actual_duration INTEGER DEFAULT 0,
  tabs_hidden INTEGER DEFAULT 0,
  distractions_blocked INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS productivity_metrics (
  user_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  context_switches INTEGER DEFAULT 0,
  deep_work_minutes INTEGER DEFAULT 0,
  shallow_work_minutes INTEGER DEFAULT 0,
  unique_domains INTEGER DEFAULT 0,
  sessions_restored INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date, hour)
);

CREATE TABLE IF NOT EXISTS domain_categories (
  domain TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  is_user_set BOOLEAN DEFAULT FALSE
);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_tabs_session ON tabs(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_session ON notes(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_url ON notes(url);
CREATE INDEX IF NOT EXISTS idx_clipboard_session ON clipboard_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_task_labels_session ON task_labels(session_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_next_steps_session ON next_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_session ON focus_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON productivity_metrics(date);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_sessions(user_id);

-- Full-text search via GIN expression indexes (PostgreSQL native FTS)
CREATE INDEX IF NOT EXISTS sessions_search_idx ON sessions USING GIN(
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(tags,'') || ' ' || coalesce(summary,''))
);

CREATE INDEX IF NOT EXISTS notes_search_idx ON notes USING GIN(
  to_tsvector('english', coalesce(content,''))
);

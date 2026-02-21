export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  summary: string | null;
  tags: string[];
  taskLabels: TaskLabel[];
  isActive: boolean;
  totalActiveTime: number;
  tabCount: number;
}

export interface Tab {
  id: string;
  sessionId: string;
  url: string;
  title: string;
  favIconUrl: string | null;
  openedAt: string;
  closedAt: string | null;
  lastActiveAt: string;
  activeTime: number;
  scrollPosition: ScrollPosition;
  chromeTabId: number;
  windowId: number;
  index: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
  percentage: number;
  capturedAt: string;
}

export interface Note {
  id: string;
  sessionId: string | null;
  tabId: string | null;
  url: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClipboardEntry {
  id: string;
  sessionId: string;
  content: string;
  summary: string | null;
  sourceUrl: string | null;
  capturedAt: string;
  contentType: 'text' | 'url' | 'code' | 'other';
}

export interface TaskLabel {
  id: string;
  sessionId: string;
  label: string;
  confidence: number;
  associatedTabIds: string[];
  detectedAt: string;
}

export interface SessionSearchResult {
  session: Session;
  matchType: 'fulltext' | 'semantic' | 'hybrid';
  score: number;
  highlights: string[];
}

// Universal search result (multi-entity)
export interface UniversalSearchResult {
  resultType: 'session' | 'tab' | 'note' | 'clipboard';
  id: string;
  sessionId?: string;
  sessionName?: string;
  sessionDate?: string;
  url?: string;
  title?: string;
  content?: string;
  activeTime?: number;
  sourceUrl?: string;
  capturedAt?: string;
  createdAt?: string;
  contentType?: string;
  score?: number;
  highlights?: string[];
}

// Daily Journal
export interface DailyJournal {
  date: string;
  summary: string | null;
  tasksCompleted: { task: string; duration: number }[];
  timeBreakdown: Record<string, number>;
  keyDecisions: string[];
  totalSessions: number;
  totalActiveTime: number;
  totalTabs: number;
  totalNotes: number;
  generatedAt: string | null;
}

// Detailed journal data (per-session breakdown)
export interface JournalSessionDetail {
  id: string;
  name: string;
  totalActiveTime: number;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  tabs: {
    url: string;
    title: string;
    activeTime: number;
    visitOrder: number;
    openedAt: string;
    lastActiveAt: string | null;
    scrollPercentage: number;
  }[];
  notes: {
    content: string;
    createdAt: string;
    url: string | null;
  }[];
  clipboardEntries: {
    content: string;
    contentType: string;
    capturedAt: string;
  }[];
}

export interface JournalFocusSession {
  id: string;
  sessionId: string | null;
  goal: string;
  targetDuration: number;
  startedAt: string;
  endedAt: string | null;
  actualDuration: number;
  distractionsBlocked: number;
  completed: boolean;
}

export interface JournalDetailData {
  sessions: JournalSessionDetail[];
  focusSessions: JournalFocusSession[];
}

// Next Steps
export interface NextStep {
  id: string;
  sessionId: string;
  step: string;
  reasoning: string;
  relatedTabIds: string[];
  isCompleted: boolean;
  generatedAt: string;
}

// Focus Mode
export interface FocusSession {
  id: string;
  sessionId: string | null;
  goal: string;
  targetDuration: number;
  startedAt: string;
  endedAt: string | null;
  actualDuration: number;
  tabsHidden: number;
  distractionsBlocked: number;
  completed: boolean;
}

export interface FocusStatus {
  isActive: boolean;
  focusSessionId: string | null;
  goal: string | null;
  startedAt: string | null;
  targetDuration: number;
  elapsedMinutes: number;
  allowedTabIds: number[];
  distractionsBlocked: number;
}

// Productivity Metrics
export interface ProductivityMetric {
  date: string;
  hour: number;
  contextSwitches: number;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  uniqueDomains: number;
  sessionsRestored: number;
}

// Chrome runtime messages
export type ExtensionMessage =
  | { type: 'GET_CURRENT_SESSION' }
  | { type: 'SAVE_SESSION'; payload: { name?: string } }
  | { type: 'RESTORE_SESSION'; payload: { sessionId: string } }
  | { type: 'ADD_NOTE'; payload: { content: string; url?: string } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SCROLL_POSITION_UPDATE'; payload: ScrollPosition & { url: string } }
  | { type: 'CLIPBOARD_CAPTURED'; payload: { content: string; sourceUrl: string } }
  | { type: 'REQUEST_AI_SUMMARY'; payload: { sessionId: string } }
  | { type: 'GET_RECENT_SESSIONS' }
  | { type: 'GET_NOTES'; payload: { sessionId?: string; url?: string } }
  | { type: 'GET_CLIPBOARD_ENTRIES'; payload: { sessionId?: string; limit?: number } }
  | { type: 'START_FOCUS'; payload: { goal: string; durationMinutes: number } }
  | { type: 'END_FOCUS' }
  | { type: 'GET_FOCUS_STATUS' }
  | { type: 'ANALYZE_PAGE' }
  | { type: 'ANALYZE_ALL_TABS' }
  | { type: 'ASK_PAGE'; payload: { question: string; history: { role: 'user' | 'assistant'; content: string }[] } }
  | { type: 'RESTORE_SCROLL'; payload: { x: number; y: number } }
  | { type: 'AUTO_GROUP_TABS'; payload?: { useAI?: boolean } }
  | { type: 'TOGGLE_COMMAND_MENU' }
  | { type: 'COMMAND_EXECUTE'; payload: { command: string; args?: any } };

// Cloud Sync
export interface SyncStatus {
  configured: boolean;
  authenticated: boolean;
  userEmail: string | null;
  lastPush: string | null;
  lastPull: string | null;
}

export interface SessionState {
  currentSessionId: string | null;
  lastSyncTimestamp: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

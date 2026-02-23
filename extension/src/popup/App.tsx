import React, { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messaging';
import { getTheme, applyTheme } from '../shared/theme';
import type { Session } from '../shared/types';
import ActiveSession from './components/ActiveSession';
import SessionControls from './components/SessionControls';
import FocusMode from './components/FocusMode';
import PageChat from './components/PageChat';
import RecentSessions from './components/RecentSessions';
import AutoGroup from './components/AutoGroup';
import ClipboardHistory from './components/ClipboardHistory';
import AuthGate from './components/AuthGate';

function AppContent() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentSession();
  }, []);

  async function loadCurrentSession() {
    try {
      const session = await sendMessage<Session | null>({ type: 'GET_CURRENT_SESSION' });
      setCurrentSession(session);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzePage() {
    setAnalyzing(true);
    setAnalyzeStatus(null);
    try {
      const result = await sendMessage<{ success?: boolean; notes?: string[]; error?: string }>({
        type: 'ANALYZE_PAGE',
      });
      if (result?.success && result.notes?.length) {
        setAnalyzeStatus(`Saved ${result.notes.length} notes`);
      } else {
        setAnalyzeStatus(result?.error || 'No notes generated');
      }
    } catch {
      setAnalyzeStatus('Analysis failed');
    } finally {
      setAnalyzing(false);
      setTimeout(() => setAnalyzeStatus(null), 3000);
    }
  }

  async function handleAnalyzeAll() {
    setAnalyzingAll(true);
    setAnalyzeStatus(null);
    try {
      const result = await sendMessage<{ success?: boolean; totalAnalyzed?: number; results?: any[]; error?: string }>({
        type: 'ANALYZE_ALL_TABS',
      });
      if (result?.success) {
        setAnalyzeStatus(`Analyzed ${result.totalAnalyzed}/${result.results?.length || 0} tabs`);
      } else {
        setAnalyzeStatus(result?.error || 'Analysis failed');
      }
    } catch {
      setAnalyzeStatus('Analysis failed');
    } finally {
      setAnalyzingAll(false);
      setTimeout(() => setAnalyzeStatus(null), 5000);
    }
  }

  if (loading) {
    return (
      <div className="w-80 h-40 flex items-center justify-center bg-gray-900">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-900 text-white font-sans">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <h1 className="text-sm font-semibold">Session Memory</h1>
        </div>
        <button
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
          className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
          title="Open Dashboard"
        >
          Dashboard
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </header>

      <div className="p-3 space-y-2.5">
        {/* Current Session */}
        <ActiveSession session={currentSession} />

        {/* Focus Mode */}
        <FocusMode />

        {/* Recent Sessions */}
        <RecentSessions currentSessionId={currentSession?.id} />

        {/* Clipboard History */}
        <ClipboardHistory sessionId={currentSession?.id ?? null} />

        {/* Tab Grouping */}
        <AutoGroup />

        {/* AI Analysis */}
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 bg-purple-600/20 rounded flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><path d="M16 2l2 2-6 6"/>
              </svg>
            </div>
            <h3 className="text-xs font-semibold text-gray-200">AI Page Analysis</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAnalyzePage}
              disabled={analyzing || analyzingAll}
              className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
            >
              {analyzing ? 'Analyzing…' : 'Analyze Page'}
            </button>
            <button
              onClick={handleAnalyzeAll}
              disabled={analyzing || analyzingAll}
              className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
            >
              {analyzingAll ? 'Analyzing…' : 'Analyze All'}
            </button>
          </div>
          {analyzeStatus && (
            <p className="text-xs text-gray-400 mt-2 text-center">{analyzeStatus}</p>
          )}
        </div>

        {/* Page Chat */}
        <PageChat />

        {/* Session Controls */}
        <SessionControls session={currentSession} onSessionUpdate={loadCurrentSession} />
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    getTheme().then(applyTheme);
  }, []);

  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

import React, { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messaging';
import type { Session } from '../shared/types';
import ActiveSession from './components/ActiveSession';
import SessionControls from './components/SessionControls';
import FocusMode from './components/FocusMode';
import PageChat from './components/PageChat';
import RecentSessions from './components/RecentSessions';
import AutoGroup from './components/AutoGroup';
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
      const session = await sendMessage<Session | null>({
        type: 'GET_CURRENT_SESSION',
      });
      setCurrentSession(session);
    } catch (err) {
      console.error('Failed to load session:', err);
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
      <div className="w-80 p-4 text-center text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="w-80 bg-gray-900 text-white min-h-[400px] font-sans">
      <header className="p-3 border-b border-gray-700">
        <h1 className="text-lg font-semibold">Session Memory</h1>
      </header>
      <div className="p-3 space-y-3">
        <ActiveSession session={currentSession} />
        <FocusMode />

        {/* Recent Sessions */}
        <RecentSessions currentSessionId={currentSession?.id} />

        {/* Auto Group */}
        <AutoGroup />

        {/* Analyze Section */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-300 mb-2">AI Page Analysis</h3>
          <div className="flex gap-2">
            <button
              onClick={handleAnalyzePage}
              disabled={analyzing || analyzingAll}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Page'}
            </button>
            <button
              onClick={handleAnalyzeAll}
              disabled={analyzing || analyzingAll}
              className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
            >
              {analyzingAll ? 'Analyzing All...' : 'Analyze All Tabs'}
            </button>
          </div>
          {analyzeStatus && (
            <p className="text-xs text-gray-400 mt-2">{analyzeStatus}</p>
          )}
        </div>

        {/* Page Chat */}
        <PageChat />

        <SessionControls
          session={currentSession}
          onSessionUpdate={loadCurrentSession}
        />
        <button
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
          className="w-full text-sm text-blue-400 hover:text-blue-300 py-1"
        >
          Open Dashboard
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}

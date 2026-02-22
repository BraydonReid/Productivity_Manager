import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api-client';
import type { Session, Tab, Note, ClipboardEntry, NextStep } from '../../shared/types';

interface SessionWithDetails extends Session {
  tabs: Tab[];
  notes: Note[];
  clipboardEntries: ClipboardEntry[];
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [generatingSteps, setGeneratingSteps] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (id) {
      loadSession(id);
      loadNextSteps(id);
    }
  }, [id]);

  async function loadSession(sessionId: string) {
    const res = await apiClient.get<SessionWithDetails>(`/sessions/${sessionId}`);
    if (res.success && res.data) {
      setSession(res.data);
      setNameInput(res.data.name);
    }
    setLoading(false);
  }

  async function handleSaveName() {
    if (!id || !session || nameInput.trim() === session.name) {
      setEditingName(false);
      return;
    }
    const trimmed = nameInput.trim();
    if (!trimmed) { setEditingName(false); return; }
    const res = await apiClient.put(`/sessions/${id}`, { name: trimmed });
    if (res.success) {
      setSession((prev) => prev ? { ...prev, name: trimmed } : prev);
    }
    setEditingName(false);
  }

  async function loadNextSteps(sessionId: string) {
    const res = await apiClient.get<NextStep[]>(`/ai/next-steps/${sessionId}`);
    if (res.success && res.data) {
      setNextSteps(res.data);
    }
  }

  async function handleGenerateNextSteps() {
    if (!id) return;
    setGeneratingSteps(true);
    const res = await apiClient.post<{ steps: NextStep[] }>('/ai/next-steps', { sessionId: id });
    if (res.success && res.data) {
      setNextSteps(res.data.steps || []);
    }
    setGeneratingSteps(false);
  }

  async function handleToggleStep(stepId: string) {
    const res = await apiClient.put<NextStep>(`/ai/next-steps/${stepId}/toggle`, {});
    if (res.success && res.data) {
      setNextSteps((prev) => prev.map((s) => (s.id === stepId ? res.data! : s)));
    }
  }

  async function handleRestore() {
    if (!id) return;
    const res = await apiClient.post<{ tabs: Tab[] }>(`/sessions/${id}/restore`, {});
    if (res.success && res.data) {
      for (const tab of res.data.tabs) {
        chrome.tabs.create({ url: tab.url });
      }
    }
  }

  async function handleSummarize() {
    if (!id) return;
    await apiClient.post('/ai/summarize-session', { sessionId: id });
    loadSession(id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Session not found</p>
      </div>
    );
  }

  const minutes = Math.round(session.totalActiveTime / 60000);

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white mb-5 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to sessions
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-2 group flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setNameInput(session.name); setEditingName(false); }
              }}
              className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none w-full text-gray-900 dark:text-white"
            />
          ) : (
            <h2
              className="text-2xl font-bold cursor-pointer truncate text-gray-900 dark:text-white"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {session.name}
            </h2>
          )}
          {!editingName && (
            <button
              onClick={() => setEditingName(true)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity flex-shrink-0"
              title="Rename session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSummarize}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            AI Summarize
          </button>
          <button
            onClick={handleRestore}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            Restore Session
          </button>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex gap-4 mb-6 text-sm text-gray-500 dark:text-gray-400">
        <span>{new Date(session.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span>&middot;</span>
        <span>{session.tabCount} tabs</span>
        <span>&middot;</span>
        <span>{minutes}m active</span>
        {session.isActive && (
          <>
            <span>&middot;</span>
            <span className="text-green-500 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
              Active now
            </span>
          </>
        )}
      </div>

      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {session.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-lg font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {session.summary && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1.5">AI Summary</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{session.summary}</p>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Next Steps</h3>
          <button
            onClick={handleGenerateNextSteps}
            disabled={generatingSteps}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-1.5"
          >
            {generatingSteps ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : nextSteps.length > 0 ? 'Regenerate' : 'Generate Next Steps'}
          </button>
        </div>

        {nextSteps.length === 0 && !generatingSteps && (
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Generate AI-suggested next actions based on your session activity.
          </p>
        )}

        {nextSteps.length > 0 && (
          <div className="space-y-2">
            {nextSteps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  step.isCompleted
                    ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <button
                  onClick={() => handleToggleStep(step.id)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    step.isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-400 dark:border-gray-600 hover:border-green-500'
                  }`}
                >
                  {step.isCompleted && <span className="text-xs">&#10003;</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${
                    step.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {step.step}
                  </p>
                  {step.reasoning && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 leading-relaxed">{step.reasoning}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <section className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Tabs <span className="text-gray-500 dark:text-gray-400 font-normal">({session.tabs.length})</span>
        </h3>
        <div className="space-y-1.5">
          {session.tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              {tab.favIconUrl ? (
                <img src={tab.favIconUrl} className="w-4 h-4 flex-shrink-0" alt="" />
              ) : (
                <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{tab.title || tab.url}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{tab.url}</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {Math.round(tab.activeTime / 60000)}m
              </span>
            </div>
          ))}
        </div>
      </section>

      {session.notes.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Notes <span className="text-gray-500 dark:text-gray-400 font-normal">({session.notes.length})</span>
          </h3>
          <div className="space-y-2">
            {session.notes.map((note) => (
              <div
                key={note.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3"
              >
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {session.clipboardEntries.length > 0 && (
        <section className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Clipboard <span className="text-gray-500 dark:text-gray-400 font-normal">({session.clipboardEntries.length})</span>
          </h3>
          <div className="space-y-2">
            {session.clipboardEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3"
              >
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                  {entry.content}
                </p>
                {entry.summary && (
                  <p className="text-xs text-purple-600 dark:text-purple-300 mt-2">{entry.summary}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

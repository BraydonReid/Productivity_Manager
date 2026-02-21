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

  useEffect(() => {
    if (id) {
      loadSession(id);
      loadNextSteps(id);
    }
  }, [id]);

  async function loadSession(sessionId: string) {
    const res = await apiClient.get<SessionWithDetails>(
      `/sessions/${sessionId}`
    );
    if (res.success && res.data) {
      setSession(res.data);
    }
    setLoading(false);
  }

  async function loadNextSteps(sessionId: string) {
    const res = await apiClient.get<NextStep[]>(
      `/ai/next-steps/${sessionId}`
    );
    if (res.success && res.data) {
      setNextSteps(res.data);
    }
  }

  async function handleGenerateNextSteps() {
    if (!id) return;
    setGeneratingSteps(true);
    const res = await apiClient.post<{ steps: NextStep[] }>('/ai/next-steps', {
      sessionId: id,
    });
    if (res.success && res.data) {
      setNextSteps(res.data.steps || []);
    } else if (!res.success) {
      console.error('Next steps error:', res.error);
    }
    setGeneratingSteps(false);
  }

  async function handleToggleStep(stepId: string) {
    const res = await apiClient.put<NextStep>(
      `/ai/next-steps/${stepId}/toggle`,
      {}
    );
    if (res.success && res.data) {
      setNextSteps((prev) =>
        prev.map((s) => (s.id === stepId ? res.data! : s))
      );
    }
  }

  async function handleRestore() {
    if (!id) return;
    const res = await apiClient.post<{ tabs: Tab[] }>(
      `/sessions/${id}/restore`,
      {}
    );
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

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!session) return <div className="text-gray-500">Session not found</div>;

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => navigate('/')}
        className="text-sm text-gray-400 hover:text-white mb-4"
      >
        &larr; Back to sessions
      </button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{session.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSummarize}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm"
          >
            AI Summarize
          </button>
          <button
            onClick={handleRestore}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
          >
            Restore Session
          </button>
        </div>
      </div>

      {session.summary && (
        <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-purple-300 mb-1">
            AI Summary
          </h3>
          <p className="text-sm text-gray-300">{session.summary}</p>
        </div>
      )}

      {/* Next Steps Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Next Steps</h3>
          <button
            onClick={handleGenerateNextSteps}
            disabled={generatingSteps}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-sm"
          >
            {generatingSteps
              ? 'Generating...'
              : nextSteps.length > 0
              ? 'Regenerate'
              : 'Generate Next Steps'}
          </button>
        </div>

        {nextSteps.length === 0 && !generatingSteps && (
          <p className="text-sm text-gray-500">
            Generate AI-suggested next actions based on your session activity.
          </p>
        )}

        {nextSteps.length > 0 && (
          <div className="space-y-2">
            {nextSteps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  step.isCompleted
                    ? 'border-gray-800 bg-gray-800/50 opacity-60'
                    : 'border-gray-700 bg-gray-800'
                }`}
              >
                <button
                  onClick={() => handleToggleStep(step.id)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    step.isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-600 hover:border-green-400'
                  }`}
                >
                  {step.isCompleted && (
                    <span className="text-xs">&#10003;</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      step.isCompleted
                        ? 'line-through text-gray-500'
                        : 'text-gray-200'
                    }`}
                  >
                    {step.step}
                  </p>
                  {step.reasoning && (
                    <p className="text-xs text-gray-500 mt-1">
                      {step.reasoning}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-3">
          Tabs ({session.tabs.length})
        </h3>
        <div className="space-y-2">
          {session.tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded p-3"
            >
              {tab.favIconUrl && (
                <img src={tab.favIconUrl} className="w-4 h-4" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{tab.title || tab.url}</p>
                <p className="text-xs text-gray-500 truncate">{tab.url}</p>
              </div>
              <span className="text-xs text-gray-500">
                {Math.round(tab.activeTime / 60000)}m
              </span>
            </div>
          ))}
        </div>
      </section>

      {session.notes.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            Notes ({session.notes.length})
          </h3>
          <div className="space-y-2">
            {session.notes.map((note) => (
              <div
                key={note.id}
                className="bg-gray-900 border border-gray-800 rounded p-3"
              >
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {session.clipboardEntries.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3">
            Clipboard ({session.clipboardEntries.length})
          </h3>
          <div className="space-y-2">
            {session.clipboardEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-900 border border-gray-800 rounded p-3"
              >
                <p className="text-sm font-mono whitespace-pre-wrap line-clamp-3">
                  {entry.content}
                </p>
                {entry.summary && (
                  <p className="text-xs text-purple-300 mt-1">
                    {entry.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

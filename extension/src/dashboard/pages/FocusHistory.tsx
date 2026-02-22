import React, { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api-client';
import type { FocusSession } from '../../shared/types';

interface FocusStats {
  totalSessions: number;
  totalFocusMinutes: number;
  avgDuration: number;
  completionRate: number;
  totalDistractionsBlocked: number;
}

interface StartAgainState {
  goal: string;
  duration: number;
}

export default function FocusHistory() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [startAgain, setStartAgain] = useState<StartAgainState | null>(null);
  const [starting, setStarting] = useState(false);
  const [startResult, setStartResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<FocusSession[]>('/focus'),
      apiClient.get<FocusStats>('/focus/stats'),
    ]).then(([sessionsRes, statsRes]) => {
      if (sessionsRes.success && sessionsRes.data) setSessions(sessionsRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      setLoading(false);
    });
  }, []);

  async function handleStartAgain() {
    if (!startAgain) return;
    setStarting(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'START_FOCUS',
        payload: { goal: startAgain.goal, durationMinutes: startAgain.duration },
      });
      setStartResult('success');
      setStartAgain(null);
      setTimeout(() => setStartResult(null), 3000);
    } catch {
      setStartResult('error');
      setTimeout(() => setStartResult(null), 3000);
    }
    setStarting(false);
  }

  // Deduplicated recent goals for quick-start
  const recentGoals = Array.from(
    new Map(sessions.map((s) => [s.goal, s])).values()
  ).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Focus History</h2>

      {/* Stats */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-8">
          <StatBox label="Sessions" value={stats.totalSessions} />
          <StatBox label="Focus Hours" value={`${(stats.totalFocusMinutes / 60).toFixed(1)}h`} />
          <StatBox label="Avg Duration" value={`${stats.avgDuration}m`} />
          <StatBox label="Completion" value={`${stats.completionRate}%`} accent="green" />
          <StatBox label="Blocked" value={stats.totalDistractionsBlocked} accent="yellow" />
        </div>
      )}

      {/* Quick-start from recent goals */}
      {recentGoals.length > 0 && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quick Start</h3>
          <div className="flex flex-wrap gap-2">
            {recentGoals.map((s) => (
              <button
                key={s.id}
                onClick={() => setStartAgain({ goal: s.goal, duration: s.targetDuration })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors group"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                </svg>
                {s.goal}
                <span className="text-xs text-gray-400 dark:text-gray-500">{s.targetDuration}m</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Start Again modal */}
      {startAgain && (
        <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-3">Start Focus Session</h3>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={startAgain.goal}
              onChange={(e) => setStartAgain({ ...startAgain, goal: e.target.value })}
              className="flex-1 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="What are you focusing on?"
            />
            <select
              value={startAgain.duration}
              onChange={(e) => setStartAgain({ ...startAgain, duration: Number(e.target.value) })}
              className="bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 rounded-lg px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              {[15, 25, 45, 60, 90].map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStartAgain}
              disabled={starting || !startAgain.goal.trim()}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting…
                </>
              ) : 'Start Focus'}
            </button>
            <button
              onClick={() => setStartAgain(null)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {startResult === 'success' && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Focus session started! Switch to your browser window.
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No focus sessions yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Start a focus session from the extension popup to begin tracking.
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">All Sessions</h3>
          <div className="space-y-2.5">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{session.goal}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(session.startedAt).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })} at{' '}
                      {new Date(session.startedAt).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.completed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-lg">
                        <span className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full" />
                        Completed
                      </span>
                    ) : session.endedAt ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-lg">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full" />
                        Ended early
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-lg">
                        <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" />
                        In progress
                      </span>
                    )}
                    <button
                      onClick={() => setStartAgain({ goal: session.goal, duration: session.targetDuration })}
                      className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      title="Start this focus again"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Start Again
                    </button>
                  </div>
                </div>
                <div className="flex gap-5 mt-2.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>Target: {session.targetDuration}m</span>
                  <span>Actual: {session.actualDuration}m</span>
                  {session.distractionsBlocked > 0 && (
                    <span>{session.distractionsBlocked} distractions blocked</span>
                  )}
                </div>
                {session.endedAt && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${session.completed ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{
                          width: `${Math.min(100, (session.actualDuration / session.targetDuration) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: {
  label: string;
  value: string | number;
  accent?: 'green' | 'yellow' | 'blue';
}) {
  const accentColor = accent === 'green' ? 'text-green-600 dark:text-green-400'
    : accent === 'yellow' ? 'text-yellow-600 dark:text-yellow-400'
    : accent === 'blue' ? 'text-blue-600 dark:text-blue-400'
    : 'text-gray-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center">
      <p className={`text-xl font-bold ${accentColor}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
}

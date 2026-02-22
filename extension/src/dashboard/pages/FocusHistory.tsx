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

export default function FocusHistory() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [loading, setLoading] = useState(true);

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

      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-8">
          <StatBox label="Sessions" value={stats.totalSessions} />
          <StatBox label="Focus Hours" value={`${(stats.totalFocusMinutes / 60).toFixed(1)}h`} />
          <StatBox label="Avg Duration" value={`${stats.avgDuration}m`} />
          <StatBox label="Completion" value={`${stats.completionRate}%`} accent="green" />
          <StatBox label="Blocked" value={stats.totalDistractionsBlocked} accent="yellow" />
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
                <div className="flex-shrink-0">
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

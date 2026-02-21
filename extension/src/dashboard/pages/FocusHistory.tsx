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

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Focus Mode History</h2>

      {/* Stats */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-8">
          <StatBox label="Total Sessions" value={stats.totalSessions} />
          <StatBox
            label="Focus Hours"
            value={`${(stats.totalFocusMinutes / 60).toFixed(1)}h`}
          />
          <StatBox label="Avg Duration" value={`${stats.avgDuration}m`} />
          <StatBox
            label="Completion"
            value={`${stats.completionRate}%`}
          />
          <StatBox
            label="Distractions Blocked"
            value={stats.totalDistractionsBlocked}
          />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">No focus sessions yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            Start a focus session from the extension popup to begin tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{session.goal}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(session.startedAt).toLocaleDateString()} at{' '}
                    {new Date(session.startedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  {session.completed ? (
                    <span className="text-green-400 text-sm font-medium">
                      Completed
                    </span>
                  ) : session.endedAt ? (
                    <span className="text-yellow-400 text-sm font-medium">
                      Ended early
                    </span>
                  ) : (
                    <span className="text-blue-400 text-sm font-medium">
                      In progress
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-6 mt-3 text-xs text-gray-500">
                <span>
                  Target: {session.targetDuration}m
                </span>
                <span>
                  Actual: {session.actualDuration}m
                </span>
                <span>
                  Distractions blocked: {session.distractionsBlocked}
                </span>
              </div>
              {session.endedAt && (
                <div className="mt-2">
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        session.completed ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (session.actualDuration / session.targetDuration) * 100
                        )}%`,
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

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

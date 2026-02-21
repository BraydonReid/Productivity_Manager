import React, { useEffect, useState } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { Session } from '../../shared/types';

interface Props {
  currentSessionId?: string;
}

export default function RecentSessions({ currentSessionId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    try {
      const result = await sendMessage<Session[]>({ type: 'GET_RECENT_SESSIONS' });
      const filtered = (result || []).filter((s) => s.id !== currentSessionId);
      setSessions(filtered.slice(0, 5));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(sessionId: string) {
    setRestoringId(sessionId);
    try {
      await sendMessage({ type: 'RESTORE_SESSION', payload: { sessionId } });
    } catch {
      // Restore failed silently
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Recent Sessions</h3>
      <div className="space-y-1.5">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{s.name}</p>
              <p className="text-xs text-gray-500">
                {s.tabCount} tabs &middot; {Math.round(s.totalActiveTime / 60000)}m
              </p>
            </div>
            <button
              onClick={() => handleRestore(s.id)}
              disabled={restoringId !== null}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium shrink-0 transition-colors"
            >
              {restoringId === s.id ? 'Opening...' : 'Resume'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

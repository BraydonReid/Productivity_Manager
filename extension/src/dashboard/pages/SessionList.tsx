import React, { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api-client';
import type { Session } from '../../shared/types';
import SessionCard from '../components/SessionCard';

export default function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const res = await apiClient.get<Session[]>('/sessions');
    if (res.success && res.data) {
      setSessions(res.data);
    }
    setLoading(false);
  }

  async function handleRename(sessionId: string, name: string) {
    const res = await apiClient.put(`/sessions/${sessionId}`, { name });
    if (res.success) {
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, name } : s));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No sessions yet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 max-w-xs mx-auto">
          Start browsing and save your first session from the extension popup.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sessions</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{sessions.length} total</span>
      </div>
      <div className="grid gap-2.5">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onRename={(name) => handleRename(session.id, name)}
          />
        ))}
      </div>
    </div>
  );
}

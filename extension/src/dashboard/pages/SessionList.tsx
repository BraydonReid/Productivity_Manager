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
    return <div className="text-gray-500">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl text-gray-400">No sessions yet</h2>
        <p className="text-gray-500 mt-2">
          Start browsing and save your first session from the extension popup.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Sessions</h2>
      <div className="grid gap-3">
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

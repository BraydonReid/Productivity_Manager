import React, { useState } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { Session } from '../../shared/types';

interface Props {
  session: Session | null;
  onSessionUpdate: () => void;
}

export default function SessionControls({ session, onSessionUpdate }: Props) {
  const [sessionName, setSessionName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await sendMessage({
        type: 'SAVE_SESSION',
        payload: { name: sessionName || undefined },
      });
      setSessionName('');
      onSessionUpdate();
    } catch (err) {
      console.error('Failed to save session:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSidebar() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Session name (optional)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm font-medium"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleToggleSidebar}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Notes Sidebar
        </button>
      </div>
    </div>
  );
}

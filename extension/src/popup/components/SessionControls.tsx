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
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-400">Session Controls</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Name this session…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
      <button
        onClick={handleToggleSidebar}
        className="w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors flex items-center justify-center gap-2"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Toggle Notes Sidebar
      </button>
    </div>
  );
}

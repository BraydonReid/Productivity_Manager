import React, { useState } from 'react';
import { sendMessage } from '../../shared/messaging';

export default function AutoGroup() {
  const [grouping, setGrouping] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleGroup(useAI: boolean) {
    setGrouping(true);
    setStatus(null);
    try {
      const result = await sendMessage<{ success?: boolean; groups?: any[]; error?: string }>({
        type: 'AUTO_GROUP_TABS',
        payload: { useAI },
      });
      if (result?.success) {
        setStatus(`Created ${result.groups?.length || 0} groups`);
      } else {
        setStatus(result?.error || 'Grouping failed');
      }
    } catch {
      setStatus('Grouping failed');
    } finally {
      setGrouping(false);
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Tab Grouping</h3>
      <div className="flex gap-2">
        <button
          onClick={() => handleGroup(false)}
          disabled={grouping}
          className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
        >
          {grouping ? 'Grouping...' : 'By Domain'}
        </button>
        <button
          onClick={() => handleGroup(true)}
          disabled={grouping}
          className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
        >
          {grouping ? 'Grouping...' : 'Smart (AI)'}
        </button>
      </div>
      {status && (
        <p className="text-xs text-gray-400 mt-2">{status}</p>
      )}
    </div>
  );
}

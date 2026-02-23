import React, { useState } from 'react';
import { sendMessage } from '../../shared/messaging';

export default function AutoGroup() {
  const [grouping, setGrouping] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
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

  async function handleCollapse() {
    setCollapsing(true);
    setStatus(null);
    try {
      await sendMessage({ type: 'COMMAND_EXECUTE', payload: { command: 'collapse-groups' } });
      setStatus('Inactive groups collapsed');
    } catch {
      setStatus('Collapse failed');
    } finally {
      setCollapsing(false);
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Tab Grouping</h3>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => handleGroup(false)}
          disabled={grouping || collapsing}
          className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
        >
          {grouping ? 'Grouping...' : 'By Domain'}
        </button>
        <button
          onClick={() => handleGroup(true)}
          disabled={grouping || collapsing}
          className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
        >
          {grouping ? 'Grouping...' : 'Smart (AI)'}
        </button>
      </div>
      <button
        onClick={handleCollapse}
        disabled={grouping || collapsing}
        className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium text-gray-300 transition-colors flex items-center justify-center gap-1.5"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
          <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
        </svg>
        {collapsing ? 'Collapsing...' : 'Collapse Inactive Groups'}
      </button>
      {status && (
        <p className="text-xs text-gray-400 mt-2">{status}</p>
      )}
    </div>
  );
}

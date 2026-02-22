import React, { useEffect, useState } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { FocusStatus } from '../../shared/types';

export default function FocusMode() {
  const [status, setStatus] = useState<FocusStatus | null>(null);
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(25);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    try {
      const s = await sendMessage<FocusStatus>({ type: 'GET_FOCUS_STATUS' });
      setStatus(s);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }

  async function handleStart() {
    if (!goal.trim()) return;
    setStarting(true);
    try {
      const s = await sendMessage<FocusStatus>({
        type: 'START_FOCUS',
        payload: { goal: goal.trim(), durationMinutes: duration },
      });
      setStatus(s);
    } catch {}
    setStarting(false);
  }

  async function handleEnd() {
    try {
      await sendMessage({ type: 'END_FOCUS' });
      setStatus(null);
      setGoal('');
    } catch {}
  }

  if (loading) return null;

  if (status?.isActive) {
    const remaining = Math.max(0, status.targetDuration - status.elapsedMinutes);
    const progress = Math.min(100, (status.elapsedMinutes / status.targetDuration) * 100);

    return (
      <div className="bg-purple-900/25 border border-purple-700/60 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-purple-300">Focus Mode Active</span>
          </div>
          <span className="text-xs text-purple-400 tabular-nums">{remaining}m left</span>
        </div>
        <p className="text-sm font-medium text-white mb-2.5 truncate">{status.goal}</p>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
          <div
            className="bg-purple-500 rounded-full h-1.5 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{status.distractionsBlocked} blocked</span>
          <button
            onClick={handleEnd}
            className="text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            End Focus
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 bg-purple-600/20 rounded flex items-center justify-center">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
        <h3 className="text-xs font-semibold text-gray-200">Focus Mode</h3>
      </div>
      <input
        type="text"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
        placeholder="What are you focusing on?"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors mb-2"
      />
      <div className="flex items-center gap-2">
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white flex-shrink-0 focus:outline-none focus:border-purple-500 transition-colors"
        >
          <option value={15}>15 min</option>
          <option value={25}>25 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
          <option value={90}>90 min</option>
        </select>
        <button
          onClick={handleStart}
          disabled={starting || !goal.trim()}
          className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
        >
          {starting ? '…' : 'Start Focus'}
        </button>
      </div>
    </div>
  );
}

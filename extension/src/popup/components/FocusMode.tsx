import React, { useEffect, useState } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { FocusStatus } from '../../shared/types';

export default function FocusMode() {
  const [status, setStatus] = useState<FocusStatus | null>(null);
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(25);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

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
    } catch (err) {
      console.error('Failed to start focus:', err);
    }
    setStarting(false);
  }

  async function handleEnd() {
    try {
      await sendMessage({ type: 'END_FOCUS' });
      setStatus(null);
      setGoal('');
    } catch (err) {
      console.error('Failed to end focus:', err);
    }
  }

  if (loading) return null;

  // Active focus session
  if (status?.isActive) {
    const remaining = Math.max(0, status.targetDuration - status.elapsedMinutes);
    const progress = Math.min(100, (status.elapsedMinutes / status.targetDuration) * 100);

    return (
      <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-purple-300">Focus Mode</span>
          <span className="text-xs text-purple-400">{remaining}m left</span>
        </div>
        <p className="text-sm font-medium mb-2">{status.goal}</p>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
          <div
            className="bg-purple-500 rounded-full h-1.5 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{status.distractionsBlocked} distractions blocked</span>
          <button
            onClick={handleEnd}
            className="text-red-400 hover:text-red-300"
          >
            End Focus
          </button>
        </div>
      </div>
    );
  }

  // Start focus form
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-400 mb-2">Focus Mode</p>
      <input
        type="text"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="What are you focusing on?"
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-2"
      />
      <div className="flex items-center gap-2">
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white flex-1"
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
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-sm font-medium flex-1"
        >
          {starting ? 'Starting...' : 'Start Focus'}
        </button>
      </div>
    </div>
  );
}

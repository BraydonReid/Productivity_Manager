import React from 'react';
import type { Session } from '../../shared/types';

interface Props {
  session: Session | null;
}

export default function ActiveSession({ session }: Props) {
  if (!session) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 text-center text-gray-400">
        <p className="text-sm">No active session</p>
        <p className="text-xs mt-1">Start a new session to begin tracking</p>
      </div>
    );
  }

  const minutes = Math.round(session.totalActiveTime / 60000);

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-sm truncate">{session.name}</h2>
        <span className="flex items-center gap-1 text-xs text-green-400">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Active
        </span>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-400">
        <span>{session.tabCount} tabs</span>
        <span>{minutes}m active</span>
      </div>
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-blue-900 text-blue-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

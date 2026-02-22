import React from 'react';
import type { Session } from '../../shared/types';

interface Props {
  session: Session | null;
}

export default function ActiveSession({ session }: Props) {
  if (!session) {
    return (
      <div className="bg-gray-800 rounded-xl p-3 text-center">
        <p className="text-sm text-gray-400">No active session</p>
        <p className="text-xs text-gray-500 mt-0.5">Browse around — tracking starts automatically</p>
      </div>
    );
  }

  const minutes = Math.round(session.totalActiveTime / 60000);

  return (
    <div className="bg-gray-800 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium text-sm leading-snug truncate flex-1">{session.name}</h2>
        <span className="flex items-center gap-1 text-xs text-green-400 shrink-0 mt-0.5">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Active
        </span>
      </div>
      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          {session.tabCount} tabs
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {minutes}m active
        </span>
      </div>
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {session.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-blue-900/60 text-blue-300 text-xs rounded-md">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

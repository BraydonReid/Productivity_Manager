import React from 'react';
import type { Session } from '../../shared/types';

interface Props {
  session: Session;
}

export default function SessionCard({ session }: Props) {
  const date = new Date(session.createdAt).toLocaleDateString();
  const minutes = Math.round(session.totalActiveTime / 60000);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="font-medium truncate">{session.name}</h3>
        {session.isActive && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Active
          </span>
        )}
      </div>
      <div className="flex gap-4 mt-1 text-sm text-gray-400">
        <span>{date}</span>
        <span>{session.tabCount} tabs</span>
        <span>{minutes}m</span>
      </div>
      {session.summary && (
        <p className="text-sm text-gray-300 mt-2 line-clamp-2">
          {session.summary}
        </p>
      )}
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {session.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

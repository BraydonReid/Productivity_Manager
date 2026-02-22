import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '../../shared/types';

interface Props {
  session: Session;
  onRename: (name: string) => void;
}

export default function SessionCard({ session, onRename }: Props) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(session.name);
  const date = new Date(session.createdAt).toLocaleDateString();
  const minutes = Math.round(session.totalActiveTime / 60000);

  function handleCardClick() {
    if (!editing) navigate(`/session/${session.id}`);
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setNameInput(session.name);
    setEditing(true);
  }

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== session.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 mr-2"
          >
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => handleSave()}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-0.5 text-sm focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white transition-colors"
            />
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">{session.name}</h3>
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity flex-shrink-0"
              title="Rename"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        )}
        {session.isActive && (
          <span className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400 flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
            Active
          </span>
        )}
      </div>
      <div className="flex gap-4 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span>{date}</span>
        <span>{session.tabCount} tabs</span>
        <span>{minutes}m</span>
      </div>
      {session.summary && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2 leading-relaxed">{session.summary}</p>
      )}
      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {session.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-md">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

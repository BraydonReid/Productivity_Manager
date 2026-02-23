import React, { useEffect, useState, useCallback } from 'react';
import { sendMessage } from '../../shared/messaging';
import type { ClipboardEntry } from '../../shared/types';

interface Props {
  sessionId: string | null;
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  code: { label: 'Code', cls: 'bg-green-900/50 text-green-400' },
  url:  { label: 'URL',  cls: 'bg-blue-900/50 text-blue-400'  },
  text: { label: 'Text', cls: 'bg-gray-700 text-gray-400'     },
};

export default function ClipboardHistory({ sessionId }: Props) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await sendMessage<ClipboardEntry[]>({
        type: 'GET_CLIPBOARD_ENTRIES',
        payload: { sessionId, limit: 30 },
      });
      if (Array.isArray(result)) {
        setEntries(result.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()));
      }
    } catch {}
  }, [sessionId]);

  // Load on mount and whenever the panel is opened
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function handleCopy(entry: ClipboardEntry) {
    try {
      await navigator.clipboard.writeText(entry.content);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  if (!sessionId) return null;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span className="text-sm font-medium text-gray-300">Clipboard History</span>
          {entries.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-md">{entries.length}</span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Entry list */}
      {open && (
        <div className="border-t border-gray-700">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4 px-3">
              No clipboard entries yet. Copy something while browsing!
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-700/60">
              {entries.map((entry) => {
                const badge = TYPE_BADGE[entry.contentType] || TYPE_BADGE.text;
                let host = '';
                if (entry.sourceUrl) {
                  try { host = new URL(entry.sourceUrl).hostname.replace('www.', ''); } catch {}
                }
                const preview = entry.content.length > 120
                  ? entry.content.substring(0, 120).replace(/\s+/g, ' ') + '…'
                  : entry.content.replace(/\s+/g, ' ');
                const time = new Date(entry.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={entry.id} className="px-3 py-2 group hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {host && (
                          <span className="text-xs text-gray-500 truncate">{host}</span>
                        )}
                        <span className="text-xs text-gray-600 flex-shrink-0">{time}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(entry)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-400 transition-all"
                        title="Copy to clipboard"
                      >
                        {copiedId === entry.id ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className={`text-xs leading-relaxed break-all ${
                      entry.contentType === 'code'
                        ? 'font-mono text-green-400/80 bg-gray-900 rounded px-1.5 py-1'
                        : 'text-gray-400'
                    }`}>
                      {preview}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-3 py-1.5 border-t border-gray-700/60">
            <button
              onClick={load}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

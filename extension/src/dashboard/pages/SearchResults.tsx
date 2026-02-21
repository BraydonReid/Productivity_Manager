import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../shared/api-client';
import type { UniversalSearchResult } from '../../shared/types';

const CONTENT_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'tabs', label: 'Tabs' },
  { value: 'notes', label: 'Notes' },
  { value: 'clipboard', label: 'Clipboard' },
];

export default function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [contentType, setContentType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);

    let url = `/search?q=${encodeURIComponent(query)}&mode=hybrid&type=${contentType}`;
    if (dateFrom) url += `&from=${dateFrom}`;
    if (dateTo) url += `&to=${dateTo}`;

    const res = await apiClient.get<UniversalSearchResult[]>(url);
    if (res.success && res.data) {
      setResults(res.data);
    }
    setSearching(false);
  }

  // Group results by session
  const grouped = new Map<string, UniversalSearchResult[]>();
  const ungrouped: UniversalSearchResult[] = [];

  for (const r of results) {
    if (r.sessionId) {
      const list = grouped.get(r.sessionId) || [];
      list.push(r);
      grouped.set(r.sessionId, list);
    } else {
      ungrouped.push(r);
    }
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-4">Universal Search</h2>
      <p className="text-gray-500 text-sm mb-4">
        Search across all your sessions, tabs, notes, and clipboard history.
      </p>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "SQL error last week" or "dashboard article about churn"...'
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2.5 rounded-lg text-sm ${
              showFilters ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-4 mt-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Content Type</label>
              <div className="flex gap-1">
                {CONTENT_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setContentType(value)}
                    className={`px-2 py-1 rounded text-xs ${
                      contentType === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>
        )}
      </form>

      {searched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No results found for "{query}"</p>
          <p className="text-gray-600 text-sm mt-1">
            Try different keywords or broaden your filters.
          </p>
        </div>
      )}

      {searched && results.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Ungrouped results (sessions themselves) */}
      {ungrouped.map((r) => (
        <ResultCard key={r.id} result={r} />
      ))}

      {/* Grouped by session */}
      {Array.from(grouped.entries()).map(([sessionId, items]) => (
        <div key={sessionId} className="mb-4">
          <Link
            to={`/session/${sessionId}`}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
          >
            Session: {items[0].sessionName || 'Untitled'}
            <span className="text-xs text-gray-600">
              {items[0].sessionDate
                ? new Date(items[0].sessionDate).toLocaleDateString()
                : ''}
            </span>
          </Link>
          <div className="pl-4 border-l border-gray-800 space-y-2">
            {items.map((r) => (
              <ResultCard key={`${r.resultType}-${r.id}`} result={r} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ result }: { result: UniversalSearchResult }) {
  const typeColors: Record<string, string> = {
    session: 'bg-blue-900/50 text-blue-300',
    tab: 'bg-green-900/50 text-green-300',
    note: 'bg-yellow-900/50 text-yellow-300',
    clipboard: 'bg-purple-900/50 text-purple-300',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded text-xs ${typeColors[result.resultType] || ''}`}>
          {result.resultType}
        </span>
        {result.resultType === 'tab' && result.title && (
          <span className="text-sm font-medium truncate">{result.title}</span>
        )}
      </div>

      {result.resultType === 'tab' && result.url && (
        <p className="text-xs text-gray-500 truncate">{result.url}</p>
      )}

      {result.resultType === 'note' && result.content && (
        <p className="text-sm text-gray-300 line-clamp-2">{result.content}</p>
      )}

      {result.resultType === 'clipboard' && result.content && (
        <p className="text-sm text-gray-300 font-mono line-clamp-2">{result.content}</p>
      )}

      {result.resultType === 'session' && result.highlights && result.highlights.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          {result.highlights.slice(0, 2).map((h, i) => (
            <p key={i} className="truncate">...{h}...</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-1 text-xs text-gray-600">
        {result.createdAt && (
          <span>{new Date(result.createdAt).toLocaleDateString()}</span>
        )}
        {result.capturedAt && (
          <span>{new Date(result.capturedAt).toLocaleDateString()}</span>
        )}
        {result.activeTime !== undefined && result.activeTime > 0 && (
          <span>{Math.round(result.activeTime / 60000)}m active</span>
        )}
      </div>
    </div>
  );
}

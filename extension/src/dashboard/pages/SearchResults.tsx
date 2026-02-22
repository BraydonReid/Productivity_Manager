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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Universal Search</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search across all your sessions, tabs, notes, and clipboard history.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "SQL error last week" or "dashboard article about churn"…'
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-medium text-white text-sm transition-colors flex items-center gap-2"
          >
            {searching ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching…
              </>
            ) : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white border border-gray-200 dark:border-gray-700'
            }`}
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Content Type</label>
              <div className="flex gap-1">
                {CONTENT_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setContentType(value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      contentType === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}
      </form>

      {searched && results.length === 0 && !searching && (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No results found for "{query}"</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Try different keywords or broaden your filters.
          </p>
        </div>
      )}

      {searched && results.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      <div className="space-y-2">
        {ungrouped.map((r) => (
          <ResultCard key={r.id} result={r} />
        ))}
      </div>

      {Array.from(grouped.entries()).map(([sessionId, items]) => (
        <div key={sessionId} className="mb-4">
          <Link
            to={`/session/${sessionId}`}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-2 font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
            {items[0].sessionName || 'Untitled'}
            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
              {items[0].sessionDate ? new Date(items[0].sessionDate).toLocaleDateString() : ''}
            </span>
          </Link>
          <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-1.5">
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
  const typeBadge: Record<string, string> = {
    session: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    tab: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    note: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
    clipboard: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeBadge[result.resultType] || ''}`}>
          {result.resultType}
        </span>
        {result.resultType === 'tab' && result.title && (
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{result.title}</span>
        )}
      </div>

      {result.resultType === 'tab' && result.url && (
        <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{result.url}</p>
      )}

      {result.resultType === 'note' && result.content && (
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{result.content}</p>
      )}

      {result.resultType === 'clipboard' && result.content && (
        <p className="text-sm text-gray-700 dark:text-gray-300 font-mono line-clamp-2">{result.content}</p>
      )}

      {result.resultType === 'session' && result.highlights && result.highlights.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {result.highlights.slice(0, 2).map((h, i) => (
            <p key={i} className="truncate">…{h}…</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
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

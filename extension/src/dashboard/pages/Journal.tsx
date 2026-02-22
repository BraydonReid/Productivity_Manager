import React, { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api-client';
import type {
  DailyJournal,
  JournalDetailData,
  JournalSessionDetail,
  JournalFocusSession,
} from '../../shared/types';

export default function Journal() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [journal, setJournal] = useState<DailyJournal | null>(null);
  const [detail, setDetail] = useState<JournalDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => { loadJournal(date); }, [date]);

  async function loadJournal(d: string) {
    setLoading(true);
    setExpandedSessions(new Set());

    const [journalRes, detailRes] = await Promise.all([
      apiClient.get<DailyJournal>(`/journal/${d}`),
      apiClient.get<JournalDetailData>(`/journal/${d}/detail`),
    ]);

    if (journalRes.success) setJournal(journalRes.data || null);
    if (detailRes.success && detailRes.data) setDetail(detailRes.data);
    else setDetail(null);

    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await apiClient.post<DailyJournal>(`/journal/${date}/generate`, {});
    if (res.success && res.data) setJournal(res.data);
    setGenerating(false);
  }

  function navigateDate(offset: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split('T')[0]);
  }

  function toggleSession(id: string) {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isToday = date === new Date().toISOString().split('T')[0];
  const hasData = detail && (detail.sessions.length > 0 || detail.focusSessions.length > 0);
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Journal</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{displayDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
          >
            ← Prev
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => navigateDate(1)}
            disabled={isToday}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No activity on this day</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Browse around and your activity will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Day stats */}
          {detail && (
            <div className="grid grid-cols-5 gap-3">
              <StatBox label="Sessions" value={detail.sessions.length} />
              <StatBox
                label="Active Time"
                value={formatDuration(detail.sessions.reduce((s, sess) => s + sess.totalActiveTime, 0))}
              />
              <StatBox
                label="Tabs"
                value={detail.sessions.reduce((s, sess) => s + sess.tabs.length, 0)}
              />
              <StatBox
                label="Notes"
                value={detail.sessions.reduce((s, sess) => s + sess.notes.length, 0)}
              />
              <StatBox label="Focus" value={detail.focusSessions.length} />
            </div>
          )}

          {/* AI Summary */}
          {journal?.summary ? (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">AI Summary</h3>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed text-sm">{journal.summary}</p>

              {journal.keyDecisions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800/50">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">Key Decisions</p>
                  <ul className="space-y-1.5">
                    {journal.keyDecisions.map((d, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-yellow-500 mt-1 text-[8px]">&#9679;</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 mx-auto"
              >
                {generating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : 'Generate AI Summary'}
              </button>
            </div>
          )}

          {/* Focus Sessions */}
          {detail && detail.focusSessions.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Focus Sessions</h3>
              <div className="space-y-2">
                {detail.focusSessions.map((f) => (
                  <FocusCard key={f.id} focus={f} />
                ))}
              </div>
            </section>
          )}

          {/* Session Timeline */}
          {detail && detail.sessions.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Session Timeline</h3>
              <div className="space-y-2.5">
                {detail.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isExpanded={expandedSessions.has(session.id)}
                    onToggle={() => toggleSession(session.id)}
                    focusSessions={detail.focusSessions.filter((f) => f.sessionId === session.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Time by Domain */}
          {journal && Object.keys(journal.timeBreakdown).length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Time by Domain</h3>
              <div className="space-y-2">
                {Object.entries(journal.timeBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([domain, minutes]) => (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 w-48 truncate">{domain}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-blue-500 rounded-full h-2 transition-all"
                          style={{
                            width: `${Math.min(100, (minutes / Math.max(...Object.values(journal.timeBreakdown))) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">{minutes}m</span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
  focusSessions,
}: {
  session: JournalSessionDetail;
  isExpanded: boolean;
  onToggle: () => void;
  focusSessions: JournalFocusSession[];
}) {
  const startTime = new Date(session.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-white">{session.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {startTime} &middot; {formatDuration(session.totalActiveTime)} active
              &middot; {session.tabs.length} tabs
              {session.notes.length > 0 && ` · ${session.notes.length} notes`}
              {focusSessions.length > 0 && (
                <span className="text-purple-600 dark:text-purple-400"> · {focusSessions.length} focus</span>
              )}
            </p>
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
          {session.summary && (
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg leading-relaxed">
              {session.summary}
            </p>
          )}

          {focusSessions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2">Focus Sessions</p>
              {focusSessions.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className={f.completed ? 'text-green-500' : 'text-yellow-500'}>
                    {f.completed ? '✓' : '○'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{f.goal}</span>
                  <span className="text-gray-400 dark:text-gray-600">{f.actualDuration}/{f.targetDuration}m</span>
                  {f.distractionsBlocked > 0 && (
                    <span className="text-gray-400 dark:text-gray-600">{f.distractionsBlocked} blocked</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {session.tabs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Tabs (ordered by last visited)
              </p>
              <div className="space-y-0.5">
                {session.tabs.map((tab, i) => {
                  let domain = '';
                  try { domain = new URL(tab.url).hostname.replace('www.', ''); } catch {}

                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <span className="text-[10px] text-gray-400 dark:text-gray-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{tab.title || domain}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-600 truncate">{domain}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {tab.activeTime > 0 && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">{formatDuration(tab.activeTime)}</span>
                        )}
                        {tab.scrollPercentage > 0 && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-600">{Math.round(tab.scrollPercentage)}% read</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {session.notes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-500 mb-2">Notes</p>
              <div className="space-y-2">
                {session.notes.map((note, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {note.url && (
                        <span className="ml-2">
                          on {(() => { try { return new URL(note.url).hostname; } catch { return ''; } })()}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.clipboardEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Clipboard ({session.clipboardEntries.length})
              </p>
              <div className="space-y-1">
                {session.clipboardEntries.slice(0, 5).map((c, i) => (
                  <p key={i} className="text-[11px] text-gray-600 dark:text-gray-500 font-mono truncate bg-gray-100 dark:bg-gray-800/30 px-2 py-1 rounded-md">
                    {c.content.substring(0, 100)}
                  </p>
                ))}
                {session.clipboardEntries.length > 5 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-600">+{session.clipboardEntries.length - 5} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FocusCard({ focus }: { focus: JournalFocusSession }) {
  const progress = focus.targetDuration > 0
    ? Math.min(100, (focus.actualDuration / focus.targetDuration) * 100)
    : 0;

  return (
    <div className="bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${focus.completed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
            {focus.completed ? 'Completed' : focus.endedAt ? 'Ended early' : 'In progress'}
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{focus.goal}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(focus.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
          <div
            className={`rounded-full h-1.5 transition-all ${focus.completed ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-500">{focus.actualDuration}/{focus.targetDuration}m</span>
        {focus.distractionsBlocked > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-600">{focus.distractionsBlocked} blocked</span>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) {
    const seconds = Math.round(ms / 1000);
    return `${seconds}s`;
  }
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

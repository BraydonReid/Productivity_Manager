import React, { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api-client';
import type { ProductivityMetric } from '../../shared/types';

interface AnalyticsData {
  totalSessions: number;
  totalTabs: number;
  totalNotes: number;
  totalActiveTime: number;
  sessionsRestored: number;
  topDomains: { domain: string; visits: number; totalTime: number }[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [metrics, setMetrics] = useState<ProductivityMetric[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    apiClient.get<AnalyticsData>('/sessions/analytics').then((res) => {
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData({
          totalSessions: 0,
          totalTabs: 0,
          totalNotes: 0,
          totalActiveTime: 0,
          sessionsRestored: 0,
          topDomains: [],
        });
      }
    });
    loadMetrics();
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  async function loadMetrics() {
    const now = new Date();
    let from: string;

    if (dateRange === 'today') {
      from = now.toISOString().split('T')[0];
    } else if (dateRange === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().split('T')[0];
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      from = d.toISOString().split('T')[0];
    }

    const to = now.toISOString().split('T')[0];
    const res = await apiClient.get<ProductivityMetric[]>(`/sessions/metrics?from=${from}&to=${to}`);
    if (res.success && res.data) setMetrics(res.data);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalContextSwitches = metrics.reduce((sum, m) => sum + m.contextSwitches, 0);
  const totalDeepWork = metrics.reduce((sum, m) => sum + m.deepWorkMinutes, 0);
  const totalShallowWork = metrics.reduce((sum, m) => sum + m.shallowWorkMinutes, 0);
  const deepWorkRatio =
    totalDeepWork + totalShallowWork > 0
      ? Math.round((totalDeepWork / (totalDeepWork + totalShallowWork)) * 100)
      : 0;

  const timeRecoveredMinutes = data.sessionsRestored * 5;

  const hourlyData = new Map<number, { deep: number; switches: number }>();
  for (const m of metrics) {
    const existing = hourlyData.get(m.hour) || { deep: 0, switches: 0 };
    existing.deep += m.deepWorkMinutes;
    existing.switches += m.contextSwitches;
    hourlyData.set(m.hour, existing);
  }

  const dailyData = new Map<string, { deep: number; shallow: number; switches: number }>();
  for (const m of metrics) {
    const existing = dailyData.get(m.date) || { deep: 0, shallow: 0, switches: 0 };
    existing.deep += m.deepWorkMinutes;
    existing.shallow += m.shallowWorkMinutes;
    existing.switches += m.contextSwitches;
    dailyData.set(m.date, existing);
  }

  const hours = Math.round(data.totalActiveTime / 3600000);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Productivity Intelligence</h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <StatCard label="Sessions" value={data.totalSessions} />
        <StatCard label="Active Hours" value={hours} />
        <StatCard label="Deep Work" value={`${deepWorkRatio}%`} accent="green" />
        <StatCard label="Ctx Switches" value={totalContextSwitches} accent="yellow" />
        <StatCard label="Time Saved" value={`${timeRecoveredMinutes}m`} accent="blue" />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Work Quality */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Work Quality</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-green-600 dark:text-green-400 font-medium">Deep Work</span>
                <span className="text-gray-500 dark:text-gray-400">{totalDeepWork}m</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                <div className="bg-green-500 rounded-full h-2.5 transition-all" style={{ width: `${deepWorkRatio}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">Shallow Work</span>
                <span className="text-gray-500 dark:text-gray-400">{totalShallowWork}m</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                <div className="bg-yellow-500 rounded-full h-2.5 transition-all" style={{ width: `${100 - deepWorkRatio}%` }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Deep work = 5+ min on a single domain without switching.
          </p>
        </section>

        {/* Peak Hours */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Peak Hours</h3>
          <div className="flex gap-0.5 h-28 items-end">
            {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => {
              const hourData = hourlyData.get(h);
              const maxDeep = Math.max(...Array.from(hourlyData.values()).map((v) => v.deep), 1);
              const height = hourData ? (hourData.deep / maxDeep) * 100 : 0;

              return (
                <div key={h} className="flex flex-col items-center justify-end flex-1 h-full">
                  <div
                    className={`w-full rounded-t transition-all ${
                      height > 60 ? 'bg-green-500' : height > 30 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                    style={{ height: `${Math.max(3, height)}%` }}
                  />
                  <span className="text-[8px] text-gray-400 dark:text-gray-600 mt-1">
                    {h % 3 === 0 ? `${h}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Hours 6–23, colored by deep work intensity.
          </p>
        </section>
      </div>

      {/* Daily Breakdown */}
      {dailyData.size > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Daily Breakdown</h3>
          <div className="space-y-2.5">
            {Array.from(dailyData.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, d]) => {
                const total = d.deep + d.shallow;
                const deepPct = total > 0 ? (d.deep / total) * 100 : 0;

                return (
                  <div key={date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 flex h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ width: `${deepPct}%` }} />
                      <div className="bg-yellow-400 dark:bg-yellow-500" style={{ width: `${100 - deepPct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right flex-shrink-0">{total}m</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right flex-shrink-0">{d.switches} switches</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Top Domains */}
      {data.topDomains.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Top Domains</h3>
          <div className="space-y-1">
            {data.topDomains.map(({ domain, visits, totalTime }) => (
              <div key={domain} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{domain}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">{visits} visits</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">{Math.round(totalTime / 60000)}m</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: {
  label: string;
  value: string | number;
  accent?: 'green' | 'yellow' | 'blue';
}) {
  const accentColor = accent === 'green' ? 'text-green-600 dark:text-green-400'
    : accent === 'yellow' ? 'text-yellow-600 dark:text-yellow-400'
    : accent === 'blue' ? 'text-blue-600 dark:text-blue-400'
    : 'text-gray-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${accentColor}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
}

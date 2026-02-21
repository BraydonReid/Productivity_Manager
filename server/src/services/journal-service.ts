import { getDaySessionData, upsertJournal, getJournal } from '../db/repositories/journal-repo.js';
import { getOpenAIKey } from '../config.js';
import OpenAI from 'openai';

export async function generateDailyJournal(date: string, userId: string): Promise<{
  summary: string;
  tasksCompleted: { task: string; duration: number }[];
  timeBreakdown: Record<string, number>;
  keyDecisions: string[];
}> {
  const dayData = getDaySessionData(date, userId);

  if (dayData.sessions.length === 0) {
    return {
      summary: 'No work sessions recorded for this day.',
      tasksCompleted: [],
      timeBreakdown: {},
      keyDecisions: [],
    };
  }

  // Build time breakdown by domain
  const timeBreakdown: Record<string, number> = {};
  for (const tab of dayData.tabs) {
    try {
      const domain = new URL(tab.url).hostname.replace('www.', '');
      timeBreakdown[domain] = (timeBreakdown[domain] || 0) + Math.round(tab.active_time / 60000);
    } catch {}
  }

  // Aggregate stats
  const totalActiveTime = dayData.sessions.reduce((sum, s) => sum + s.total_active_time, 0);

  // Generate AI summary
  const key = getOpenAIKey();
  if (!key) {
    // No AI key — return raw data summary
    const result = {
      summary: `Worked across ${dayData.sessions.length} sessions for ${Math.round(totalActiveTime / 60000)} minutes. Visited ${dayData.tabs.length} pages and took ${dayData.notes.length} notes.`,
      tasksCompleted: dayData.sessions.map((s) => ({
        task: s.name,
        duration: Math.round(s.total_active_time / 60000),
      })),
      timeBreakdown,
      keyDecisions: [],
    };

    upsertJournal({
      userId,
      date,
      summary: result.summary,
      tasksCompleted: result.tasksCompleted,
      timeBreakdown: result.timeBreakdown,
      keyDecisions: result.keyDecisions,
      totalSessions: dayData.sessions.length,
      totalActiveTime,
      totalTabs: dayData.tabs.length,
      totalNotes: dayData.notes.length,
    });

    return result;
  }

  const client = new OpenAI({ apiKey: key });

  const topTabs = dayData.tabs
    .slice(0, 30)
    .map((t) => `- ${t.title} (${t.url}) [${Math.round(t.active_time / 60000)}min]`)
    .join('\n');

  const notesSummary = dayData.notes
    .slice(0, 15)
    .map((n) => `- ${n.content.substring(0, 150)}`)
    .join('\n');

  const sessionList = dayData.sessions
    .map((s) => `- "${s.name}" (${Math.round(s.total_active_time / 60000)}min, started ${s.created_at})`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a productivity assistant generating a daily work journal. Return a JSON object with:
{
  "summary": "2-3 sentence overview of the day's work",
  "tasksCompleted": [{"task": "description", "duration": minutes}],
  "keyDecisions": ["decision 1", "decision 2"]
}
Be specific and actionable. Focus on what was accomplished, not just what was visited.`,
      },
      {
        role: 'user',
        content: `Date: ${date}
Total active time: ${Math.round(totalActiveTime / 60000)} minutes

Sessions:
${sessionList}

Top pages visited (by time):
${topTabs}

${notesSummary ? `Notes taken:\n${notesSummary}` : 'No notes taken.'}

${dayData.clipboardEntries.length > 0 ? `Clipboard entries: ${dayData.clipboardEntries.length} items captured` : ''}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.3,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    parsed = {};
  }

  const result = {
    summary: (parsed.summary as string) || 'Unable to generate summary.',
    tasksCompleted: (parsed.tasksCompleted as { task: string; duration: number }[]) || [],
    timeBreakdown,
    keyDecisions: (parsed.keyDecisions as string[]) || [],
  };

  upsertJournal({
    userId,
    date,
    summary: result.summary,
    tasksCompleted: result.tasksCompleted,
    timeBreakdown: result.timeBreakdown,
    keyDecisions: result.keyDecisions,
    totalSessions: dayData.sessions.length,
    totalActiveTime,
    totalTabs: dayData.tabs.length,
    totalNotes: dayData.notes.length,
  });

  return result;
}

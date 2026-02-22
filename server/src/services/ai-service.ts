import OpenAI from 'openai';
import { getOpenAIKey } from '../config.js';

function getClient(): OpenAI {
  const key = getOpenAIKey();
  if (!key) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey: key });
}

export async function summarizeSession(sessionData: {
  name: string;
  tabs: { url: string; title: string; activeTime: number; scrollPercentage?: number }[];
  notes: { content: string }[];
  clipboardEntries?: { content: string; contentType: string }[];
  totalActiveTime: number;
}): Promise<string> {
  const client = getClient();

  const totalMinutes = Math.round(sessionData.totalActiveTime / 60000);

  const tabSummary = sessionData.tabs
    .sort((a, b) => b.activeTime - a.activeTime)
    .slice(0, 20)
    .map((t) => {
      const mins = Math.round(t.activeTime / 60000);
      const scroll = t.scrollPercentage != null ? ` ${Math.round(t.scrollPercentage)}% read` : '';
      return `- ${t.title} [${mins}min${scroll}]`;
    })
    .join('\n');

  const notesSummary = sessionData.notes.length > 0
    ? sessionData.notes.slice(0, 10).map((n) => `- ${n.content.substring(0, 300)}`).join('\n')
    : '';

  const clipboardSummary = sessionData.clipboardEntries && sessionData.clipboardEntries.length > 0
    ? sessionData.clipboardEntries.slice(0, 5).map((c) => `- [${c.contentType}] ${c.content.substring(0, 150)}`).join('\n')
    : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert productivity coach summarizing a user's work session. Write a helpful 3-4 sentence summary that:
1. States what they were primarily working on and their apparent goal
2. Highlights key accomplishments or discoveries (be specific — mention actual topics, tools, or decisions from the tab titles/notes)
3. Notes any unfinished work or potential follow-ups (e.g., tabs with low read % suggest unfinished reading)
4. Ends with one concrete observation about their focus or work pattern

Be direct, specific, and genuinely useful — not generic. Reference actual content from the session.`,
      },
      {
        role: 'user',
        content: `Session: "${sessionData.name}"
Active time: ${totalMinutes} minutes across ${sessionData.tabs.length} unique pages

Pages by time spent:
${tabSummary}
${notesSummary ? `\nNotes captured:\n${notesSummary}` : ''}
${clipboardSummary ? `\nClipboard items:\n${clipboardSummary}` : ''}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content || 'Unable to generate summary.';
}

export async function generateSessionName(tabs: { url: string; title: string }[]): Promise<string> {
  const client = getClient();

  const tabList = tabs
    .slice(0, 15)
    .map((t) => `- ${t.title}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Generate a short (3-6 word) descriptive name for this browsing session based on the tabs visited. Return only the name, nothing else.',
      },
      {
        role: 'user',
        content: `Tabs:\n${tabList}`,
      },
    ],
    max_tokens: 30,
    temperature: 0.5,
  });

  return response.choices[0]?.message?.content?.trim() || 'Untitled Session';
}

export async function detectTasks(
  tabs: { id: string; url: string; title: string; activeTime: number }[]
): Promise<{ label: string; confidence: number; tabIds: string[] }[]> {
  const client = getClient();

  const tabList = tabs.map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    minutes: Math.round(t.activeTime / 60000),
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Analyze these browser tabs and identify distinct tasks or projects the user was working on. Return a JSON array of tasks:
[{"label": "short task description", "confidence": 0.0-1.0, "tabIds": ["id1", "id2"]}]
Group related tabs into the same task. Be specific about what the task involves.`,
      },
      {
        role: 'user',
        content: JSON.stringify(tabList),
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.3,
  });

  try {
    const content = response.choices[0]?.message?.content || '{"tasks":[]}';
    const parsed = JSON.parse(content);
    return parsed.tasks || parsed;
  } catch {
    return [];
  }
}

export async function summarizeClipboard(content: string): Promise<string> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Summarize this clipboard content in one brief sentence. If it\'s code, describe what it does. If it\'s text, capture the key point.',
      },
      {
        role: 'user',
        content: content.substring(0, 2000),
      },
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '';
}

export async function generateNextSteps(sessionData: {
  name: string;
  tabs: { id: string; url: string; title: string; activeTime: number; scrollPercentage: number }[];
  notes: { content: string }[];
  clipboardEntries: { content: string; contentType: string }[];
  summary: string | null;
}): Promise<{ step: string; reasoning: string; relatedTabIds: string[] }[]> {
  const client = getClient();

  const tabInfo = sessionData.tabs
    .sort((a, b) => b.activeTime - a.activeTime)
    .slice(0, 20)
    .map((t) => `- [${t.id}] ${t.title} (${t.url}) [${Math.round(t.activeTime / 60000)}min, ${Math.round(t.scrollPercentage)}% scrolled]`)
    .join('\n');

  const notesInfo = sessionData.notes
    .slice(0, 10)
    .map((n) => `- ${n.content.substring(0, 200)}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a productivity assistant. Based on the user's work session, suggest 3-5 specific next actions they should take to continue their work. Consider:
- Tabs with low scroll percentage (unfinished reading)
- Notes with TODO items or questions
- Research that seems incomplete
- Documents that were being drafted

Return JSON: {"steps": [{"step": "action description", "reasoning": "why this matters", "relatedTabIds": ["id1"]}]}`,
      },
      {
        role: 'user',
        content: `Session: "${sessionData.name}"
${sessionData.summary ? `Previous summary: ${sessionData.summary}` : ''}

Tabs (with scroll progress):
${tabInfo}

${notesInfo ? `Notes:\n${notesInfo}` : ''}

${sessionData.clipboardEntries.length > 0 ? `Clipboard entries: ${sessionData.clipboardEntries.length} items saved` : ''}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.4,
  });

  try {
    const content = response.choices[0]?.message?.content || '{"steps":[]}';
    const parsed = JSON.parse(content);
    return parsed.steps || [];
  } catch {
    return [];
  }
}

export async function analyzePageContent(page: {
  title: string;
  url: string;
  content: string;
}): Promise<string[]> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a productivity assistant. Analyze this webpage and extract the most important notes a user would want to remember. Return a JSON object:
{"notes": ["note 1", "note 2", ...]}

Guidelines:
- Extract 3-7 key takeaways, facts, or action items
- Be specific and concise — each note should be 1-2 sentences
- Focus on actionable information, key data points, decisions, and important details
- If it's a code page, note the key concepts or solutions shown
- If it's documentation, note the essential API details or steps
- Skip boilerplate, navigation text, and ads`,
      },
      {
        role: 'user',
        content: `Page: "${page.title}"
URL: ${page.url}

Content:
${page.content.substring(0, 5000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"notes":[]}');
    return parsed.notes || [];
  } catch {
    return [];
  }
}

export async function chatWithPage(page: {
  title: string;
  url: string;
  content: string;
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}): Promise<string> {
  const client = getClient();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a helpful assistant answering questions about a specific webpage. Use the page content provided to give accurate, concise answers. If the answer isn't in the page content, say so clearly.

Page: "${page.title}"
URL: ${page.url}

Page Content:
${page.content.substring(0, 5000)}`,
    },
    // Include conversation history
    ...page.history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    {
      role: 'user' as const,
      content: page.question,
    },
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 500,
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content || 'Unable to generate a response.';
}

export async function clusterTabs(
  tabs: { id: number; url: string; title: string }[]
): Promise<{ label: string; tabIds: number[] }[]> {
  const client = getClient();

  const tabList = tabs.map((t) => `[${t.id}] ${t.title} (${t.url})`).join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Group these browser tabs into logical clusters by task or topic. Return JSON:
{"clusters": [{"label": "short group name (2-4 words)", "tabIds": [id1, id2]}]}
Group related tabs together. Each tab should appear in exactly one group. Use descriptive, concise labels.`,
      },
      { role: 'user', content: tabList },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"clusters":[]}');
    return parsed.clusters || [];
  } catch {
    return [];
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000),
  });

  return response.data[0].embedding;
}

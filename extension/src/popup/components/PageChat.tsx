import React, { useState, useRef, useEffect } from 'react';
import { sendMessage } from '../../shared/messaging';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function PageChat() {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'success' | 'error' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleExport() {
    setExporting(true);
    setExportStatus(null);
    try {
      const result = await sendMessage<{ success?: boolean; data?: Record<string, unknown>; error?: string }>({
        type: 'EXPORT_PAGE_DATA',
      });

      if (result?.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const title = (result.data.title as string) || 'page-export';
        a.href = url;
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportStatus('success');
      } else {
        setExportStatus('error');
      }
    } catch {
      setExportStatus('error');
    } finally {
      setExporting(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: question };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await sendMessage<{ success?: boolean; answer?: string; error?: string }>({
        type: 'ASK_PAGE',
        payload: {
          question,
          history: messages,
        },
      });

      if (result?.success && result.answer) {
        setMessages([...updatedMessages, { role: 'assistant', content: result.answer }]);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: result?.error || 'Failed to get a response.' }]);
      }
    } catch {
      setMessages([...updatedMessages, { role: 'assistant', content: 'Connection error.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span>Ask About This Page</span>
        <span className="text-xs text-gray-500">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Chat messages */}
          <div className="max-h-48 overflow-y-auto mb-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-gray-500 py-2">
                Ask any question about the current page...
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-xs rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600/30 text-blue-200 ml-4'
                    : 'bg-gray-700 text-gray-200 mr-4'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div className="bg-gray-700 text-gray-400 text-xs rounded-lg px-3 py-2 mr-4">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
            >
              Send
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            {messages.length > 0 ? (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                Clear chat
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              {exportStatus === 'success' && (
                <span className="text-xs text-green-400">Downloaded!</span>
              )}
              {exportStatus === 'error' && (
                <span className="text-xs text-red-400">Nothing to export</span>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
                title="Export page tables and structured data as JSON"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {exporting ? 'Exporting…' : 'Export Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

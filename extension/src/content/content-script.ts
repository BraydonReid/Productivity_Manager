import { SCROLL_DEBOUNCE_MS } from '../shared/constants';

// Capture copy events immediately and forward to background for saving
document.addEventListener('copy', (e) => {
  const text = e.clipboardData?.getData('text/plain');
  if (!text || !text.trim()) return;
  chrome.runtime.sendMessage({
    type: 'CLIPBOARD_CAPTURED',
    payload: { content: text.trim(), sourceUrl: window.location.href },
  }).catch(() => {});
});

let sidebarVisible = false;
let sidebarContainer: HTMLDivElement | null = null;

// Scroll position tracking (debounced)
let scrollTimer: ReturnType<typeof setTimeout>;

window.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;

    chrome.runtime.sendMessage({
      type: 'SCROLL_POSITION_UPDATE',
      payload: {
        x: window.scrollX,
        y: window.scrollY,
        percentage: Math.round(percentage * 100) / 100,
        capturedAt: new Date().toISOString(),
        url: window.location.href,
      },
    }).catch(() => {});
  }, SCROLL_DEBOUNCE_MS);
});

// Active time tracking
let activeStartTime = Date.now();
let totalActiveTime = 0;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    totalActiveTime += Date.now() - activeStartTime;
  } else {
    activeStartTime = Date.now();
  }
});

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    toggleSidebar();
    sendResponse({ ok: true });
  } else if (message.type === 'GET_PAGE_CONTENT') {
    sendResponse(extractPageContent());
  } else if (message.type === 'GET_EXPORT_DATA') {
    sendResponse(extractExportData());
  } else if (message.type === 'TOGGLE_COMMAND_MENU') {
    toggleCommandMenu();
    sendResponse({ ok: true });
  } else if (message.type === 'RESTORE_SCROLL') {
    window.scrollTo({
      left: message.payload.x,
      top: message.payload.y,
      behavior: 'smooth',
    });
    sendResponse({ ok: true });
  }
  return false;
});

function extractPageContent(): { title: string; url: string; content: string; structuredData: string } {
  const title = document.title || '';
  const url = window.location.href;

  // Collect meaningful text from the page
  const parts: string[] = [];

  // Get meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const desc = metaDesc.getAttribute('content');
    if (desc) parts.push(desc);
  }

  // Get headings
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach((h) => {
    const text = (h as HTMLElement).innerText?.trim();
    if (text) parts.push(text);
  });

  // Get main content — prefer article/main elements, fall back to body
  const mainEl = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]');
  const contentEl = mainEl || document.body;

  // Get paragraph text
  const paragraphs = contentEl.querySelectorAll('p, li, td, pre, code, blockquote');
  paragraphs.forEach((p) => {
    const text = (p as HTMLElement).innerText?.trim();
    if (text && text.length > 20) parts.push(text);
  });

  const content = parts.join('\n').substring(0, 6000);
  const structuredData = extractStructuredData();
  return { title, url, content, structuredData };
}

/**
 * Extract structured data from the page: HTML tables, tier lists, definition lists.
 * Returns a plain-text representation the AI can reason about.
 */
function extractStructuredData(): string {
  const sections: string[] = [];

  // 1. Standard HTML <table> elements
  document.querySelectorAll('table').forEach((table, i) => {
    const caption = (table.querySelector('caption') as HTMLElement | null)?.innerText?.trim() || `Table ${i + 1}`;
    const rows = Array.from(table.querySelectorAll('tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells.map((c) => (c as HTMLElement).innerText?.trim().replace(/\s+/g, ' ')).join(' | ');
    }).filter((r) => r.trim());
    if (rows.length > 1) sections.push(`[TABLE: ${caption}]\n${rows.join('\n')}`);
  });

  // 2. Tier lists — detect .label-holder/.tier pattern (e.g. tiermaker.com)
  //    The pattern: <label-holder> sibling immediately before <div class="tier sort">
  const tierData: string[] = [];
  document.querySelectorAll('.label-holder, [class*="tier-label"], [class*="tier-header"]').forEach((labelEl) => {
    const tierName = (labelEl.querySelector('.label, span') as HTMLElement | null)?.innerText?.trim()
      || (labelEl as HTMLElement).innerText?.trim() || '';
    if (!tierName) return;

    // Find the adjacent tier content (next sibling or following sibling with .tier or .tier-row)
    let sibling = labelEl.nextElementSibling;
    while (sibling && !sibling.classList.contains('tier') && !sibling.className.includes('tier-row')) {
      sibling = sibling.nextElementSibling;
    }
    if (!sibling) return;

    const itemNames = extractItemNames(sibling);
    if (itemNames.length > 0) {
      tierData.push(`${tierName}: ${itemNames.join(', ')}`);
    }
  });

  // Also try generic .tier.sort containers (if label-holder approach missed them)
  if (tierData.length === 0) {
    document.querySelectorAll('.tier.sort, [class*="tier-row"], [class*="tier-content"]').forEach((tierEl) => {
      const prev = tierEl.previousElementSibling;
      const labelEl = prev?.querySelector('.label, [class*="label"], span') || prev;
      const tierName = labelEl ? (labelEl as HTMLElement).innerText?.trim() : '';
      const itemNames = extractItemNames(tierEl);
      if (itemNames.length > 0) {
        tierData.push(`${tierName || 'Tier'}: ${itemNames.join(', ')}`);
      }
    });
  }

  if (tierData.length > 0) sections.push(`[TIER LIST]\n${tierData.join('\n')}`);

  // 3. Definition lists <dl>
  document.querySelectorAll('dl').forEach((dl, i) => {
    const entries: string[] = [];
    dl.querySelectorAll('dt').forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd?.tagName === 'DD') {
        const key = (dt as HTMLElement).innerText?.trim();
        const val = (dd as HTMLElement).innerText?.trim();
        if (key && val) entries.push(`${key}: ${val}`);
      }
    });
    if (entries.length > 1) sections.push(`[DATA LIST ${i + 1}]\n${entries.join('\n')}`);
  });

  return sections.join('\n\n');
}

/** Extract item names from a tier/grid container using multiple strategies. */
function extractItemNames(container: Element): string[] {
  const names: string[] = [];
  const items = container.querySelectorAll(
    '.character, [class*="character"], [class*="item"], [class*="operator"], [class*="card"], [class*="hero"]'
  );

  items.forEach((item) => {
    const img = item.querySelector('img') as HTMLImageElement | null;

    // Strategy 1: img alt or title attribute
    const altName = img?.alt?.trim() || img?.title?.trim() || '';
    if (altName && altName.length > 1) { names.push(altName); return; }

    // Strategy 2: filename from img src
    const src = img?.src || '';
    if (src) {
      const m = src.match(/\/([^/?#]+?)\.(png|jpg|jpeg|gif|webp)/i);
      if (m) { names.push(cleanFileName(m[1])); return; }
    }

    // Strategy 3: filename from background-image style
    const bgImage = (item as HTMLElement).style?.backgroundImage || '';
    if (bgImage) {
      const m = bgImage.match(/\/([^/?#"']+?)\.(png|jpg|jpeg|gif|webp)/i);
      if (m) { names.push(cleanFileName(m[1])); return; }
    }

    // Strategy 4: inner text
    const text = (item as HTMLElement).innerText?.trim();
    if (text && text.length > 0 && text.length < 50) names.push(text);
  });

  return names;
}

function cleanFileName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')        // dashes/underscores → spaces
    .replace(/icon$/i, '')         // strip trailing "icon"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Full structured export: returns JSON-serialisable object with tables and tier lists.
 * Used by the EXPORT_PAGE_DATA message.
 */
function extractExportData(): object {
  const tables: object[] = [];
  document.querySelectorAll('table').forEach((table, i) => {
    const caption = (table.querySelector('caption') as HTMLElement | null)?.innerText?.trim() || `Table ${i + 1}`;
    const headers = Array.from(table.querySelectorAll('thead th, thead td, tr:first-child th')).map(
      (c) => (c as HTMLElement).innerText?.trim()
    );
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((c) => (c as HTMLElement).innerText?.trim())
    ).filter((r) => r.length > 0 && r.some(Boolean));
    if (rows.length > 0) tables.push({ name: caption, headers, rows });
  });

  const tierLists: object[] = [];
  const tierMap: Record<string, string[]> = {};

  document.querySelectorAll('.label-holder, [class*="tier-label"], [class*="tier-header"]').forEach((labelEl) => {
    const tierName = (labelEl.querySelector('.label, span') as HTMLElement | null)?.innerText?.trim()
      || (labelEl as HTMLElement).innerText?.trim() || '';
    if (!tierName) return;
    let sibling = labelEl.nextElementSibling;
    while (sibling && !sibling.classList.contains('tier') && !sibling.className.includes('tier-row')) {
      sibling = sibling.nextElementSibling;
    }
    if (!sibling) return;
    const items = extractItemNames(sibling);
    if (items.length > 0) tierMap[tierName] = items;
  });

  if (Object.keys(tierMap).length > 0) {
    tierLists.push({ tiers: tierMap });
  }

  return {
    title: document.title,
    url: window.location.href,
    exportedAt: new Date().toISOString(),
    tables,
    tierLists,
    structuredText: extractStructuredData(),
  };
}

function toggleSidebar(): void {
  if (sidebarVisible && sidebarContainer) {
    sidebarContainer.remove();
    sidebarContainer = null;
    sidebarVisible = false;
    return;
  }

  createSidebar();
  sidebarVisible = true;
}

function createSidebar(): void {
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'session-memory-sidebar';

  const shadow = sidebarContainer.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      .sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 320px;
        height: 100vh;
        background: #1a1a2e;
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: -2px 0 12px rgba(0,0,0,0.4);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        font-size: 14px;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #2a2a4a;
        background: #16162a;
      }
      .header h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .close-btn {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
      }
      .close-btn:hover { color: #fff; }
      .notes-area {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
      }
      .note-item {
        background: #222244;
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 8px;
        font-size: 13px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
      .note-time {
        font-size: 11px;
        color: #666;
        margin-top: 4px;
      }
      .input-area {
        padding: 12px 16px;
        border-top: 1px solid #2a2a4a;
      }
      textarea {
        width: 100%;
        min-height: 80px;
        background: #222244;
        border: 1px solid #333366;
        border-radius: 6px;
        color: #e0e0e0;
        padding: 8px;
        font-size: 13px;
        resize: vertical;
        box-sizing: border-box;
        font-family: inherit;
      }
      textarea:focus {
        outline: none;
        border-color: #4466ff;
      }
      .save-btn {
        width: 100%;
        margin-top: 8px;
        padding: 8px;
        background: #3355ff;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
      }
      .save-btn:hover { background: #4466ff; }
      .empty-state {
        text-align: center;
        color: #666;
        padding: 40px 20px;
        font-size: 13px;
      }
    </style>
    <div class="sidebar">
      <div class="header">
        <h2>Session Notes</h2>
        <button class="close-btn" id="close-sidebar">&times;</button>
      </div>
      <div class="notes-area" id="notes-list">
        <div class="empty-state">No notes yet. Add your first note below.</div>
      </div>
      <div class="input-area">
        <textarea id="note-input" placeholder="Write a note..."></textarea>
        <button class="save-btn" id="save-note">Save Note</button>
      </div>
    </div>
  `;

  // Event listeners
  shadow.getElementById('close-sidebar')!.addEventListener('click', () => {
    toggleSidebar();
  });

  shadow.getElementById('save-note')!.addEventListener('click', () => {
    const textarea = shadow.getElementById('note-input') as HTMLTextAreaElement;
    const content = textarea.value.trim();
    if (!content) return;

    chrome.runtime.sendMessage({
      type: 'ADD_NOTE',
      payload: { content, url: window.location.href },
    });

    // Add to the notes list visually
    const notesList = shadow.getElementById('notes-list')!;
    const emptyState = notesList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.textContent = content;
    const timeEl = document.createElement('div');
    timeEl.className = 'note-time';
    timeEl.textContent = new Date().toLocaleTimeString();
    noteItem.appendChild(timeEl);
    notesList.insertBefore(noteItem, notesList.firstChild);

    textarea.value = '';
  });

  // Allow Ctrl+Enter to save
  shadow.getElementById('note-input')!.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      shadow.getElementById('save-note')!.click();
    }
  });

  document.body.appendChild(sidebarContainer);

  // Load existing notes for this URL
  loadNotesForPage(shadow);
}

// ——— Command Menu (Spotlight) ———
let commandMenuVisible = false;
let commandMenuContainer: HTMLDivElement | null = null;

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  category: string;
}

function toggleCommandMenu(): void {
  if (commandMenuVisible && commandMenuContainer) {
    commandMenuContainer.remove();
    commandMenuContainer = null;
    commandMenuVisible = false;
    return;
  }
  createCommandMenu();
  commandMenuVisible = true;
}

async function createCommandMenu(): Promise<void> {
  commandMenuContainer = document.createElement('div');
  commandMenuContainer.id = 'session-memory-command-menu';
  const shadow = commandMenuContainer.attachShadow({ mode: 'closed' });

  // Fetch recent sessions
  let recentSessions: { id: string; name: string; tabCount: number }[] = [];
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_RECENT_SESSIONS' });
    if (Array.isArray(result)) recentSessions = result.slice(0, 5);
  } catch {}

  const commands: CommandItem[] = [
    { id: 'save-session', label: 'Save Session', icon: '\uD83D\uDCBE', category: 'Session' },
    { id: 'open-dashboard', label: 'Open Dashboard', icon: '\uD83D\uDCCA', category: 'Navigation' },
    { id: 'toggle-sidebar', label: 'Toggle Notes Sidebar', icon: '\uD83D\uDCDD', category: 'Navigation' },
    { id: 'toggle-focus', label: 'Toggle Focus Mode', icon: '\uD83C\uDFAF', category: 'Focus' },
    { id: 'auto-group', label: 'Group Tabs by Domain', icon: '\uD83D\uDCC1', category: 'Tabs' },
    { id: 'auto-group-ai', label: 'Smart Group Tabs (AI)', icon: '\uD83E\uDD16', category: 'Tabs' },
    { id: 'analyze-page', label: 'Analyze Current Page', icon: '\uD83D\uDD0D', category: 'AI' },
    ...recentSessions.map((s) => ({
      id: `restore:${s.id}`,
      label: `Resume: ${s.name}`,
      icon: '\uD83D\uDD04',
      category: 'Restore',
    })),
  ];

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 20vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .palette {
        width: 500px;
        max-height: 420px;
        background: #1a1a2e;
        border: 1px solid #333366;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .search-input {
        width: 100%;
        padding: 14px 16px;
        background: transparent;
        border: none;
        border-bottom: 1px solid #2a2a4a;
        color: #e0e0e0;
        font-size: 16px;
        outline: none;
        box-sizing: border-box;
      }
      .search-input::placeholder { color: #555; }
      .command-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
      }
      .command-item {
        padding: 10px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #e0e0e0;
      }
      .command-item.selected {
        background: #2a2a5a;
      }
      .command-item:hover {
        background: #2a2a4a;
      }
      .command-icon {
        font-size: 16px;
        width: 24px;
        text-align: center;
        flex-shrink: 0;
      }
      .command-label { flex: 1; }
      .command-category {
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
      }
      .shortcut-hint {
        padding: 8px 16px;
        border-top: 1px solid #2a2a4a;
        font-size: 11px;
        color: #555;
        display: flex;
        gap: 16px;
      }
      .shortcut-hint kbd {
        background: #222244;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 10px;
      }
    </style>
    <div class="overlay" id="cmd-overlay">
      <div class="palette">
        <input class="search-input" id="cmd-input" placeholder="Type a command..." autocomplete="off" />
        <div class="command-list" id="cmd-list"></div>
        <div class="shortcut-hint">
          <span><kbd>\u2191\u2193</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Execute</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  `;

  let selectedIndex = 0;
  let filteredCommands = [...commands];

  function renderCommands() {
    const list = shadow.getElementById('cmd-list')!;
    list.innerHTML = '';
    filteredCommands.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'command-item' + (i === selectedIndex ? ' selected' : '');
      item.innerHTML = `
        <span class="command-icon">${cmd.icon}</span>
        <span class="command-label">${cmd.label}</span>
        <span class="command-category">${cmd.category}</span>
      `;
      item.addEventListener('click', () => executeCommand(cmd.id));
      item.addEventListener('mouseenter', () => {
        selectedIndex = i;
        renderCommands();
      });
      list.appendChild(item);
    });
  }

  function filterCommands(query: string) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      filteredCommands = [...commands];
    } else {
      filteredCommands = commands.filter((cmd) => {
        const text = cmd.label.toLowerCase();
        return words.every((w) => text.includes(w));
      });
    }
    selectedIndex = 0;
    renderCommands();
  }

  const input = shadow.getElementById('cmd-input') as HTMLInputElement;
  input.addEventListener('input', () => filterCommands(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
      renderCommands();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderCommands();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      toggleCommandMenu();
    }
  });

  // Close on overlay click
  shadow.getElementById('cmd-overlay')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      toggleCommandMenu();
    }
  });

  renderCommands();
  document.body.appendChild(commandMenuContainer);
  input.focus();
}

async function executeCommand(commandId: string): Promise<void> {
  toggleCommandMenu();

  try {
    if (commandId.startsWith('restore:')) {
      const sessionId = commandId.split(':')[1];
      await chrome.runtime.sendMessage({
        type: 'COMMAND_EXECUTE',
        payload: { command: 'restore-session', args: { sessionId } },
      });
    } else if (commandId === 'auto-group-ai') {
      await chrome.runtime.sendMessage({
        type: 'COMMAND_EXECUTE',
        payload: { command: 'auto-group-ai' },
      });
    } else {
      await chrome.runtime.sendMessage({
        type: 'COMMAND_EXECUTE',
        payload: { command: commandId },
      });
    }
  } catch {}
}

async function loadNotesForPage(shadow: ShadowRoot): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_NOTES',
      payload: { url: window.location.href },
    });

    if (!response || !Array.isArray(response)) return;

    const notesList = shadow.getElementById('notes-list')!;
    if (response.length > 0) {
      notesList.innerHTML = '';
      for (const note of response) {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        noteItem.textContent = note.content;
        const timeEl = document.createElement('div');
        timeEl.className = 'note-time';
        timeEl.textContent = new Date(note.createdAt).toLocaleString();
        noteItem.appendChild(timeEl);
        notesList.appendChild(noteItem);
      }
    }
  } catch {
    // Notes loading failed silently
  }
}

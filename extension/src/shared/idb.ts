import Dexie, { type EntityTable } from 'dexie';
import type { Session, Tab, Note, ClipboardEntry } from './types';

const db = new Dexie('SessionMemoryDB') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  tabs: EntityTable<Tab, 'id'>;
  notes: EntityTable<Note, 'id'>;
  clipboardEntries: EntityTable<ClipboardEntry, 'id'>;
};

db.version(1).stores({
  sessions: 'id, name, createdAt, isActive',
  tabs: 'id, sessionId, url',
  notes: 'id, sessionId, tabId, url',
  clipboardEntries: 'id, sessionId, capturedAt',
});

export { db };

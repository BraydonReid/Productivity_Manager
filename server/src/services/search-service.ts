import { getDb } from '../db/connection.js';
import { generateEmbedding } from './ai-service.js';

interface SearchResult {
  id: string;
  name: string;
  summary: string | null;
  createdAt: string;
  score: number;
  matchType: 'fulltext' | 'semantic' | 'hybrid';
  highlights: string[];
}

export async function searchSessions(
  query: string,
  mode: 'fulltext' | 'semantic' | 'hybrid' = 'hybrid',
  userId?: string
): Promise<SearchResult[]> {
  const results: Map<string, SearchResult> = new Map();

  if (mode === 'fulltext' || mode === 'hybrid') {
    const ftsResults = fulltextSearch(query, userId);
    for (const r of ftsResults) {
      results.set(r.id, { ...r, matchType: 'fulltext' });
    }
  }

  if (mode === 'semantic' || mode === 'hybrid') {
    try {
      const semanticResults = await semanticSearch(query, userId);
      for (const r of semanticResults) {
        const existing = results.get(r.id);
        if (existing) {
          // Combine scores for hybrid
          existing.score = existing.score * 0.4 + r.score * 0.6;
          existing.matchType = 'hybrid';
        } else {
          results.set(r.id, { ...r, matchType: 'semantic' });
        }
      }
    } catch {
      // Semantic search may fail if no API key — fall back gracefully
    }
  }

  return Array.from(results.values()).sort((a, b) => b.score - a.score);
}

function fulltextSearch(query: string, userId?: string): SearchResult[] {
  const db = getDb();

  try {
    const userFilter = userId ? 'AND s.user_id = ?' : '';
    const userParam = userId ? [userId] : [];

    // Search sessions FTS
    const sessionResults = db.prepare(`
      SELECT s.id, s.name, s.summary, s.created_at,
             rank as score
      FROM sessions_fts fts
      JOIN sessions s ON s.rowid = fts.rowid
      WHERE sessions_fts MATCH ? ${userFilter}
      ORDER BY rank
      LIMIT 20
    `).all(query, ...userParam) as any[];

    // Search notes FTS and join to sessions
    const noteResults = db.prepare(`
      SELECT n.session_id as id, s.name, s.summary, s.created_at,
             rank as score, n.content as highlight
      FROM notes_fts fts
      JOIN notes n ON n.rowid = fts.rowid
      JOIN sessions s ON s.id = n.session_id
      WHERE notes_fts MATCH ? ${userFilter}
      ORDER BY rank
      LIMIT 20
    `).all(query, ...userParam) as any[];

    const merged: Map<string, SearchResult> = new Map();

    for (const r of sessionResults) {
      merged.set(r.id, {
        id: r.id,
        name: r.name,
        summary: r.summary,
        createdAt: r.created_at,
        score: Math.abs(r.score),
        matchType: 'fulltext',
        highlights: [],
      });
    }

    for (const r of noteResults) {
      if (!r.id) continue;
      const existing = merged.get(r.id);
      if (existing) {
        existing.highlights.push(r.highlight?.substring(0, 200) || '');
        existing.score += Math.abs(r.score);
      } else {
        merged.set(r.id, {
          id: r.id,
          name: r.name,
          summary: r.summary,
          createdAt: r.created_at,
          score: Math.abs(r.score),
          matchType: 'fulltext',
          highlights: [r.highlight?.substring(0, 200) || ''],
        });
      }
    }

    return Array.from(merged.values());
  } catch {
    return [];
  }
}

async function semanticSearch(query: string, userId?: string): Promise<SearchResult[]> {
  const db = getDb();
  const queryEmbedding = await generateEmbedding(query);

  const userFilter = userId ? 'AND s.user_id = ?' : '';
  const userParam = userId ? [userId] : [];

  const rows = db.prepare(`
    SELECT e.entity_id, e.vector, s.name, s.summary, s.created_at
    FROM embeddings e
    JOIN sessions s ON s.id = e.entity_id
    WHERE e.entity_type = 'session' ${userFilter}
  `).all(...userParam) as any[];

  const results: SearchResult[] = [];

  for (const row of rows) {
    const storedVector = deserializeVector(row.vector);
    const similarity = cosineSimilarity(queryEmbedding, storedVector);

    if (similarity > 0.3) {
      results.push({
        id: row.entity_id,
        name: row.name,
        summary: row.summary,
        createdAt: row.created_at,
        score: similarity,
        matchType: 'semantic',
        highlights: [],
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function deserializeVector(buffer: Buffer): number[] {
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32);
}

export function serializeVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer);
}

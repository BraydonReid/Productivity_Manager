import { getPool } from '../db/connection.js';
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
    const ftsResults = await fulltextSearch(query, userId);
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

async function fulltextSearch(query: string, userId?: string): Promise<SearchResult[]> {
  const pool = getPool();

  try {
    const userFilter = userId ? 'AND s.user_id = $2' : '';
    const sessionParams: unknown[] = [query];
    if (userId) sessionParams.push(userId);

    const tsvecExpr = `to_tsvector('english', coalesce(s.name,'') || ' ' || coalesce(s.tags,'') || ' ' || coalesce(s.summary,''))`;
    const tsquery = `plainto_tsquery('english', $1)`;

    const sessionResults = await pool.query<any>(`
      SELECT s.id, s.name, s.summary, s.created_at,
             ts_rank(${tsvecExpr}, ${tsquery}) AS score
      FROM sessions s
      WHERE ${tsvecExpr} @@ ${tsquery} ${userFilter}
      ORDER BY score DESC
      LIMIT 20
    `, sessionParams);

    const noteFilter = userId ? 'AND s.user_id = $2' : '';
    const noteParams: unknown[] = [query];
    if (userId) noteParams.push(userId);

    const noteResults = await pool.query<any>(`
      SELECT n.session_id as id, s.name, s.summary, s.created_at,
             ts_rank(to_tsvector('english', coalesce(n.content,'')), plainto_tsquery('english', $1)) AS score,
             n.content as highlight
      FROM notes n
      JOIN sessions s ON s.id = n.session_id
      WHERE to_tsvector('english', coalesce(n.content,'')) @@ plainto_tsquery('english', $1)
        ${noteFilter}
      ORDER BY score DESC
      LIMIT 20
    `, noteParams);

    const merged: Map<string, SearchResult> = new Map();

    for (const r of sessionResults.rows) {
      merged.set(r.id, {
        id: r.id,
        name: r.name,
        summary: r.summary,
        createdAt: r.created_at,
        score: parseFloat(r.score),
        matchType: 'fulltext',
        highlights: [],
      });
    }

    for (const r of noteResults.rows) {
      if (!r.id) continue;
      const existing = merged.get(r.id);
      if (existing) {
        existing.highlights.push(r.highlight?.substring(0, 200) || '');
        existing.score += parseFloat(r.score);
      } else {
        merged.set(r.id, {
          id: r.id,
          name: r.name,
          summary: r.summary,
          createdAt: r.created_at,
          score: parseFloat(r.score),
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
  const pool = getPool();
  const queryEmbedding = await generateEmbedding(query);

  const userFilter = userId ? 'AND s.user_id = $1' : '';
  const params: unknown[] = userId ? [userId] : [];

  const { rows } = await pool.query<any>(`
    SELECT e.entity_id, e.vector, s.name, s.summary, s.created_at
    FROM embeddings e
    JOIN sessions s ON s.id = e.entity_id
    WHERE e.entity_type = 'session' ${userFilter}
  `, params);

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

function deserializeVector(text: string): number[] {
  try {
    return JSON.parse(text) as number[];
  } catch {
    return [];
  }
}

export function serializeVector(vector: number[]): string {
  return JSON.stringify(Array.from(vector));
}

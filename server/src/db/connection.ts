import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set. Set it in Railway → your service → Variables.');
    }
    const isLocal = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const schemaPath = resolve(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  await getPool().query(sql);
  console.log('Database schema initialized');
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

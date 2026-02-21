import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Execute the entire schema as one batch — better-sqlite3's exec() handles multiple statements
  try {
    db.exec(schema);
  } catch (err) {
    console.warn('Schema initialization warning:', (err as Error).message);
    // If full batch fails, the tables/triggers may already exist — that's OK
  }

  // Run migrations for existing databases
  runMigrations();

  console.log('Database schema initialized');
}

function runMigrations(): void {
  const migrations = [
    'ALTER TABLE tabs ADD COLUMN visit_order INTEGER DEFAULT 0',
    "ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE focus_sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE daily_journals ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE daily_journals ADD COLUMN id TEXT",
    "ALTER TABLE productivity_metrics ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}

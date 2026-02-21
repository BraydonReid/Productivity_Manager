import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || '3712', 10),
  dbPath: process.env.DB_PATH || resolve(__dirname, '../data.db'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
};

// Allow updating the API key at runtime
const settingsPath = resolve(__dirname, '../settings.json');

export interface AppSettings {
  openaiApiKey?: string;
}

export function getSettings(): AppSettings {
  try {
    if (existsSync(settingsPath)) {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    }
  } catch {}
  return {};
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = getSettings();
  writeFileSync(settingsPath, JSON.stringify({ ...current, ...settings }, null, 2));
}

export function getOpenAIKey(): string {
  const settings = getSettings();
  return settings.openaiApiKey || config.openaiApiKey;
}

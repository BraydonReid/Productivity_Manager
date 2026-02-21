import { getDb } from '../connection.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function createUser(user: { id: string; email: string; passwordHash: string; createdAt: string }): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(user.id, user.email, user.passwordHash, user.createdAt);
}

export function getUserByEmail(email: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

import { getPool } from '../connection.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export async function createUser(user: { id: string; email: string; passwordHash: string; createdAt: string }): Promise<void> {
  await getPool().query(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
    [user.id, user.email, user.passwordHash, user.createdAt]
  );
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

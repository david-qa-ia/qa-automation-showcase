import { readFileSync } from 'node:fs';
import { hashPassword } from '../src/auth.js';
import { pool } from '../src/db.js';

export const SEED_PASSWORD = 'Passw0rd!';

export async function resetDatabase() {
  await pool.query(readFileSync('db/schema.sql', 'utf8'));
  await pool.query(readFileSync('db/seed.sql', 'utf8'));
  const users = [
    ['standard@shoplite.test', 'Standard User', false],
    ['other@shoplite.test', 'Other User', false],
    ['locked@shoplite.test', 'Locked User', true],
  ] as const;
  for (const [email, name, locked] of users) {
    await pool.query('INSERT INTO users (email, name, password_hash, locked) VALUES ($1, $2, $3, $4)', [
      email,
      name,
      hashPassword(SEED_PASSWORD),
      locked,
    ]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await resetDatabase();
  await pool.end();
  console.log('Database reset and seeded.');
}

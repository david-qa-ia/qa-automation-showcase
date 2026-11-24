import { resetDatabase } from '../scripts/db-reset.js';
import { pool } from '../src/db.js';

// One clean, known database per run. Individual tests then create
// whatever data they mutate, so they stay independent and parallel-safe.
export default async function globalSetup() {
  await resetDatabase();
  await pool.end();
}

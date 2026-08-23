import { readFileSync } from 'node:fs';

import type { Pool } from 'pg';

export const CUSTOMER_PROFILE_MIGRATION_ID = '001_create_customers';

const CUSTOMER_PROFILE_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/001_create_customers.sql', import.meta.url),
  'utf8',
);

export async function applyMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _vpzh_schema_migrations (
        migration_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('SELECT pg_advisory_xact_lock($1)', [17_017]);

    const existing = await client.query<{ migration_id: string }>(
      'SELECT migration_id FROM _vpzh_schema_migrations WHERE migration_id = $1',
      [CUSTOMER_PROFILE_MIGRATION_ID],
    );

    if (existing.rows.length === 0) {
      await client.query(CUSTOMER_PROFILE_MIGRATION_SQL);
      await client.query('INSERT INTO _vpzh_schema_migrations (migration_id) VALUES ($1)', [
        CUSTOMER_PROFILE_MIGRATION_ID,
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

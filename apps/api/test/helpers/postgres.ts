import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

import { createPostgresPool } from '../../src/infrastructure/postgres/pool.ts';

export interface IsolatedPostgresTestContext {
  readonly pool: Pool;
  readonly cleanup: () => Promise<void>;
}

export async function createIsolatedPostgresTestContext(): Promise<IsolatedPostgresTestContext> {
  const connectionString = process.env.VPZH_TEST_DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error('VPZH_TEST_DATABASE_URL must point to an isolated PostgreSQL test database');
  }

  const schema = `vpzh_test_${randomUUID().replaceAll('-', '')}`;
  const adminPool = createPostgresPool(connectionString);
  await adminPool.query(`CREATE SCHEMA "${schema}"`);
  await adminPool.end();

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    max: 4,
    options: `-c search_path="${schema}",public`,
    query_timeout: 5_000,
  });

  return {
    pool,
    async cleanup(): Promise<void> {
      await pool.end();
      const cleanupPool = createPostgresPool(connectionString);
      try {
        await cleanupPool.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await cleanupPool.end();
      }
    },
  };
}

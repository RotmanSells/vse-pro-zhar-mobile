import { createPostgresPool } from './infrastructure/postgres/pool.ts';
import { applyMigrations } from './infrastructure/postgres/migrations.ts';
import { loadRuntimeConfig } from './infrastructure/runtime-config.ts';

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  if (config.databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required to run API migrations');
  }

  const pool = createPostgresPool(config.databaseUrl);
  try {
    await applyMigrations(pool, { includeImages: true });
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error('api_migrations_failed');
  process.exitCode = 1;
});

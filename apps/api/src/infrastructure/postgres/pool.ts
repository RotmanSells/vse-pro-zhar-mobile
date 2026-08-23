import { Pool, type PoolConfig } from 'pg';

export function createPostgresPool(connectionString: string | undefined): Pool {
  const options: PoolConfig = {
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    max: 10,
    query_timeout: 5_000,
  };

  if (connectionString !== undefined) options.connectionString = connectionString;

  return new Pool(options);
}

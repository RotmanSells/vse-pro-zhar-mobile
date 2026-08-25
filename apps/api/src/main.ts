import { createApiServer } from './composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from './infrastructure/development-admin-authorization.ts';
import { createDevelopmentIdentityResolver } from './infrastructure/development-identity-boundary.ts';
import { createPostgresCategoryRepository } from './infrastructure/postgres/category-repository.ts';
import { createPostgresCustomerProfileRepository } from './infrastructure/postgres/customer-profile-repository.ts';
import { createPostgresLegalAcceptanceRepository } from './infrastructure/postgres/legal-acceptance-repository.ts';
import { createPostgresPool } from './infrastructure/postgres/pool.ts';
import { loadRuntimeConfig } from './infrastructure/runtime-config.ts';

function main(): void {
  const config = loadRuntimeConfig();
  const pool = createPostgresPool(config.databaseUrl);
  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(pool),
    categoryRepository: createPostgresCategoryRepository(pool),
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: config.developmentAdminIdentityEnabled,
      runtime: config.runtime,
    }),
    identityResolver: createDevelopmentIdentityResolver({
      enabled: config.developmentIdentityEnabled,
      runtime: config.runtime,
    }),
    legalAcceptanceRepository: createPostgresLegalAcceptanceRepository(pool),
  });

  server.on('error', (error) => {
    console.error(`api_server_failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    console.log(`API listening on ${config.host}:${config.port}`);
  });
}

try {
  main();
} catch {
  console.error('api_start_failed');
  process.exitCode = 1;
}

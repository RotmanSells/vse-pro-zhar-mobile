import assert from 'node:assert/strict';
import test from 'node:test';

import { ProductResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import { createPostgresProductCategoryReferenceRepository } from '../../src/infrastructure/postgres/product-category-reference-repository.ts';
import { createPostgresProductRepository } from '../../src/infrastructure/postgres/product-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { createProductApiClient } from '../../../mobile/src/infrastructure/product-api-client.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

await test('Mobile Product client reads persisted Product data after API reload', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const category = await categoryRepository.create({ name: 'Меню' });
  const productRepository = createPostgresProductRepository(database.pool);
  const categoryReferenceRepository = createPostgresProductCategoryReferenceRepository(
    database.pool,
  );
  const createServer = () =>
    createApiServer({
      adminIdentityResolver: createDevelopmentAdminIdentityResolver({
        enabled: true,
        runtime: 'test',
      }),
      productCategoryReferenceRepository: categoryReferenceRepository,
      productRepository,
    });
  const server = createServer();
  const port = await listenOnEphemeralPort(server);

  try {
    const createResponse = await fetch(`http://127.0.0.1:${port}/admin/products`, {
      body: JSON.stringify({
        adminEnabled: true,
        basePriceMinor: 45_050,
        categoryId: category.id,
        name: 'Меню из backend',
      }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    const createdProduct = ProductResponseSchema.parse(await createResponse.json());

    const mobileClient = createProductApiClient({ apiBaseUrl: `http://127.0.0.1:${port}` });
    await assert.doesNotReject(async () => {
      assert.deepEqual(await mobileClient.listProducts(), {
        kind: 'loaded',
        products: [createdProduct],
      });
    });

    await closeServer(server);
    const reloadedServer = createServer();
    const reloadedPort = await listenOnEphemeralPort(reloadedServer);
    try {
      const reloadedClient = createProductApiClient({
        apiBaseUrl: `http://127.0.0.1:${reloadedPort}`,
      });
      assert.deepEqual(await reloadedClient.listProducts(), {
        kind: 'loaded',
        products: [createdProduct],
      });
    } finally {
      await closeServer(reloadedServer);
    }
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { CategoryResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { createCategoryApiClient } from '../../../mobile/src/infrastructure/category-api-client.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

await test('Mobile Category client reads the persisted API response after reload', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const createServerWithCategory = () =>
    createApiServer({
      adminIdentityResolver: createDevelopmentAdminIdentityResolver({
        enabled: true,
        runtime: 'test',
      }),
      categoryRepository,
    });
  const server = createServerWithCategory();
  const port = await listenOnEphemeralPort(server);

  try {
    const createResponse = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
      body: JSON.stringify({ name: 'Мобильное меню' }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    const createdCategory = CategoryResponseSchema.parse(await createResponse.json());

    const mobileClient = createCategoryApiClient({ apiBaseUrl: `http://127.0.0.1:${port}` });
    const firstLoad = await mobileClient.listCategories();
    assert.deepEqual(firstLoad, { kind: 'loaded', categories: [createdCategory] });

    await closeServer(server);
    const reloadedServer = createServerWithCategory();
    const reloadedPort = await listenOnEphemeralPort(reloadedServer);
    try {
      const reloadedClient = createCategoryApiClient({
        apiBaseUrl: `http://127.0.0.1:${reloadedPort}`,
      });
      const reloaded = await reloadedClient.listCategories();
      assert.deepEqual(reloaded, { kind: 'loaded', categories: [createdCategory] });
    } finally {
      await closeServer(reloadedServer);
    }
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
  }
});

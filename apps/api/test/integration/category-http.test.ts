import assert from 'node:assert/strict';
import test from 'node:test';

import { CategoryListResponseSchema, CategoryResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import {
  CATEGORY_MIGRATION_ID,
  PRODUCT_MIGRATION_ID,
  applyMigrations,
} from '../../src/infrastructure/postgres/migrations.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

await test('real Admin create and Guest read persist Categories through PostgreSQL', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  await applyMigrations(database.pool);

  const migrations = await database.pool.query<{ migration_id: string }>(
    'SELECT migration_id FROM _vpzh_schema_migrations',
  );
  assert.deepEqual(migrations.rows, [
    { migration_id: '001_create_customers' },
    { migration_id: '002_create_customer_legal_acceptances' },
    { migration_id: CATEGORY_MIGRATION_ID },
    { migration_id: PRODUCT_MIGRATION_ID },
    { migration_id: '005_add_product_details' },
    { migration_id: '006_add_product_image' },
    { migration_id: '007_enforce_product_image' },
  ]);

  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    categoryRepository,
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const createResponse = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
      body: JSON.stringify({ name: '  Супы  ' }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    assert.equal(createResponse.status, 201);
    const createdCategory = CategoryResponseSchema.parse(await createResponse.json());
    assert.equal(createdCategory.name, 'Супы');

    const duplicateResponse = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
      body: JSON.stringify({ name: 'Супы' }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    assert.equal(duplicateResponse.status, 201);
    const duplicateCategory = CategoryResponseSchema.parse(await duplicateResponse.json());
    assert.notEqual(duplicateCategory.id, createdCategory.id);

    const guestResponse = await fetch(`http://127.0.0.1:${port}/categories`);
    assert.equal(guestResponse.status, 200);
    const guestCategories = CategoryListResponseSchema.parse(await guestResponse.json());
    assert.deepEqual(
      guestCategories.map((category) => category.id).sort(),
      [createdCategory.id, duplicateCategory.id].sort(),
    );

    await closeServer(server);
    const reloadedServer = createApiServer({ categoryRepository });
    const reloadedPort = await listenOnEphemeralPort(reloadedServer);
    try {
      const reloadResponse = await fetch(`http://127.0.0.1:${reloadedPort}/categories`);
      assert.equal(reloadResponse.status, 200);
      assert.deepEqual(
        CategoryListResponseSchema.parse(await reloadResponse.json()),
        guestCategories,
      );
    } finally {
      await closeServer(reloadedServer);
    }
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
  }
});

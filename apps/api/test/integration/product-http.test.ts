import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';

import {
  ApiErrorResponseSchema,
  ProductDetailsResponseSchema,
  ProductListResponseSchema,
  ProductResponseSchema,
} from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import type {
  ProductCategoryReferenceRepository,
  ProductRepository,
} from '../../src/application/catalog/product.ts';
import type { CustomerProfileRepository } from '../../src/application/customer-profile.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import { createPostgresProductCategoryReferenceRepository } from '../../src/infrastructure/postgres/product-category-reference-repository.ts';
import { createPostgresProductRepository } from '../../src/infrastructure/postgres/product-repository.ts';
import {
  PRODUCT_MIGRATION_ID,
  PRODUCT_DETAILS_MIGRATION_ID,
  applyMigrations,
} from '../../src/infrastructure/postgres/migrations.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

const adminHeaders = {
  'content-type': 'application/json',
  'x-vpzh-development-admin-identity': 'admin',
};
const securityBody = {
  adminEnabled: true,
  basePriceMinor: 45_000,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  name: 'Шашлык',
};
function postProduct(port: number, body: Record<string, unknown>): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/admin/products`, {
    body: JSON.stringify(body),
    headers: adminHeaders,
    method: 'POST',
  });
}
function patchProductDetails(
  port: number,
  productId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = adminHeaders,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/admin/products/${productId}/details`, {
    body: JSON.stringify(body),
    headers,
    method: 'PATCH',
  });
}
await test('real Admin Product create and Guest visible read persist through PostgreSQL', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool, { includeContract: false, includeImages: true });
  await applyMigrations(database.pool, { includeContract: false, includeImages: true });
  const migrations = await database.pool.query<{ migration_id: string }>(
    'SELECT migration_id FROM _vpzh_schema_migrations ORDER BY migration_id',
  );
  assert.deepEqual(migrations.rows, [
    { migration_id: '001_create_customers' },
    { migration_id: '002_create_customer_legal_acceptances' },
    { migration_id: '003_create_categories' },
    { migration_id: PRODUCT_MIGRATION_ID },
    { migration_id: PRODUCT_DETAILS_MIGRATION_ID },
    { migration_id: '006_add_product_image' },
  ]);
  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const category = await categoryRepository.create({ name: 'Шашлык' });
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
    const invalidResponse = await postProduct(port, {
      basePriceMinor: 45_000,
      categoryId: category.id,
      name: 'Без явной видимости',
    });
    assert.equal(invalidResponse.status, 400);
    assert.deepEqual(ApiErrorResponseSchema.parse(await invalidResponse.json()).error, {
      code: 'INVALID_REQUEST',
      message: 'Invalid request',
    });
    const nonIntegerPriceResponse = await postProduct(port, {
      adminEnabled: true,
      basePriceMinor: 450.5,
      categoryId: category.id,
      name: 'Неверная цена',
    });
    assert.equal(nonIntegerPriceResponse.status, 400);
    const createResponse = await postProduct(port, {
      adminEnabled: true,
      basePriceMinor: 45_050,
      categoryId: category.id,
      name: '  Шашлык из свинины  ',
    });
    assert.equal(createResponse.status, 201);
    const createdProduct = ProductResponseSchema.parse(await createResponse.json());
    assert.deepEqual(createdProduct, {
      adminEnabled: true,
      basePriceMinor: 45_050,
      categoryId: category.id,
      description: null,
      id: createdProduct.id,
      isHit: false,
      isNew: false,
      name: 'Шашлык из свинины',
      weightGrams: null,
    });
    const updateResponse = await patchProductDetails(port, createdProduct.id, {
      description: 'Сочный шашлык и специи',
      isHit: true,
      isNew: true,
      weightGrams: 350,
    });
    assert.equal(updateResponse.status, 200);
    const updatedProduct = ProductResponseSchema.parse(await updateResponse.json());
    assert.deepEqual(updatedProduct, {
      ...createdProduct,
      description: 'Сочный шашлык и специи',
      isHit: true,
      isNew: true,
      weightGrams: 350,
    });
    const detailsResponse = await fetch(`http://127.0.0.1:${port}/products/${createdProduct.id}`);
    assert.equal(detailsResponse.status, 200);
    assert.deepEqual(ProductDetailsResponseSchema.parse(await detailsResponse.json()), {
      ...updatedProduct,
      categoryName: 'Шашлык',
    });
    const invalidDetailsResponse = await patchProductDetails(port, createdProduct.id, {
      description: 'x'.repeat(501),
      isHit: false,
      isNew: false,
      weightGrams: null,
    });
    assert.equal(invalidDetailsResponse.status, 400);
    const disabledResponse = await postProduct(port, {
      adminEnabled: false,
      basePriceMinor: 12_000,
      categoryId: category.id,
      name: 'Скрытое блюдо',
    });
    assert.equal(disabledResponse.status, 201);
    const hiddenProduct = ProductResponseSchema.parse(await disabledResponse.json());
    const hiddenDetailsResponse = await fetch(
      `http://127.0.0.1:${port}/products/${hiddenProduct.id}`,
    );
    assert.equal(hiddenDetailsResponse.status, 404);
    const guestResponse = await fetch(`http://127.0.0.1:${port}/products`);
    assert.equal(guestResponse.status, 200);
    const visibleProducts = ProductListResponseSchema.parse(await guestResponse.json());
    assert.deepEqual(visibleProducts, [updatedProduct]);
    const missingCategoryResponse = await postProduct(port, {
      adminEnabled: true,
      basePriceMinor: 1_000,
      categoryId: 'a9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      name: 'Без раздела',
    });
    assert.equal(missingCategoryResponse.status, 404);
    await closeServer(server);
    const reloadedServer = createServer();
    const reloadedPort = await listenOnEphemeralPort(reloadedServer);
    try {
      const reloadedResponse = await fetch(`http://127.0.0.1:${reloadedPort}/products`);
      assert.deepEqual(ProductListResponseSchema.parse(await reloadedResponse.json()), [
        updatedProduct,
      ]);
    } finally {
      await closeServer(reloadedServer);
    }
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
  }
});
const rejected =
  (label: string): (() => Promise<never>) =>
  () =>
    Promise.reject(new Error(`${label} must not be called`));
function securityServer(
  adminIdentityResolver = createDevelopmentAdminIdentityResolver({
    enabled: true,
    runtime: 'test',
  }),
  customerProfileRepository?: CustomerProfileRepository,
) {
  const productRepository: ProductRepository = {
    create: rejected('product repository'),
    listAll: rejected('product repository'),
    listVisible: rejected('product repository'),
    updateDetails: rejected('product repository'),
    updateVisibility: rejected('product repository'),
    findVisibleById: rejected('product repository'),
  };
  const categoryReference: ProductCategoryReferenceRepository = { exists: rejected('category') };
  return createApiServer({
    adminIdentityResolver,
    ...(customerProfileRepository === undefined ? {} : { customerProfileRepository }),
    productCategoryReferenceRepository: categoryReference,
    productRepository,
  });
}
async function safeError(
  response: Response,
): Promise<ReturnType<typeof ApiErrorResponseSchema.parse>> {
  const text = await response.text();
  assert.equal(text.includes('admin'), false);
  assert.equal(text.includes('stack'), false);
  return ApiErrorResponseSchema.parse(JSON.parse(text) as unknown);
}
function securityPost(port: number, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/admin/products`, {
    body: JSON.stringify(securityBody),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  });
}
async function withSecurityServer(
  server: ReturnType<typeof createApiServer>,
  action: (port: number) => Promise<void>,
): Promise<void> {
  const port = await listenOnEphemeralPort(server);
  try {
    await action(port);
  } finally {
    await closeServer(server);
  }
}
async function duplicateSecurityHeaderStatus(port: number): Promise<number> {
  const body = JSON.stringify(securityBody);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        headers: {
          'content-length': Buffer.byteLength(body),
          'content-type': 'application/json',
          'x-vpzh-development-admin-identity': ['admin', 'admin'],
        },
        hostname: '127.0.0.1',
        method: 'POST',
        path: '/admin/products',
        port,
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}
async function assertUnauthorized(response: Response): Promise<void> {
  assert.equal(response.status, 401);
  assert.deepEqual((await safeError(response)).error, {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
  });
}
await test('Product Admin security boundary rejects identity and permission negatives', async () => {
  await withSecurityServer(securityServer(), async (port) => {
    for (const headers of [
      {},
      { 'x-vpzh-development-admin-identity': '' },
      { 'x-vpzh-development-admin-identity': 'administrator' },
    ])
      await assertUnauthorized(await securityPost(port, headers));
    assert.equal(await duplicateSecurityHeaderStatus(port), 401);
  });
  for (const runtime of ['test', 'production'] as const)
    await withSecurityServer(
      securityServer(
        createDevelopmentAdminIdentityResolver({ enabled: runtime === 'production', runtime }),
      ),
      async (port) =>
        assertUnauthorized(
          await securityPost(port, { 'x-vpzh-development-admin-identity': 'admin' }),
        ),
    );
  await withSecurityServer(
    securityServer(undefined, {
      findOrCreateByPhone: rejected('customer'),
      updateById: rejected('customer'),
    }),
    async (port) => {
      await assertUnauthorized(
        await securityPost(port, { 'x-vpzh-development-identity': '+7 900 000-00-00' }),
      );
      await assertUnauthorized(
        await fetch(`http://127.0.0.1:${port}/me/profile`, {
          headers: { 'x-vpzh-development-admin-identity': 'admin' },
        }),
      );
    },
  );
  await withSecurityServer(
    securityServer({
      resolve: () => ({ kind: 'development_admin', role: 'viewer', subject: 'development-admin' }),
    }),
    async (port) => {
      const response = await securityPost(port, { 'x-vpzh-development-admin-identity': 'admin' });
      assert.equal(response.status, 403);
      assert.deepEqual((await safeError(response)).error, {
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    },
  );
});

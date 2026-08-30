import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { createPostgresProductRepository } from '../../src/infrastructure/postgres/product-repository.ts';
import { createCategoryApiClient } from '../../../mobile/src/infrastructure/category-api-client.ts';
import { searchCatalogProducts } from '../../../mobile/src/application/catalog/catalog-search.ts';
import { createProductApiClient } from '../../../mobile/src/infrastructure/product-api-client.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

await test('local search uses the reloaded persisted catalog without a search request', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool, { includeContract: false, includeImages: true });
  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const meatCategory = await categoryRepository.create({ name: 'Шашлык' });
  const vegetableCategory = await categoryRepository.create({ name: 'Овощи на гриле' });
  const productRepository = createPostgresProductRepository(database.pool);
  const firstProduct = await productRepository.create({
    adminEnabled: true,
    basePriceMinor: 45_000,
    categoryId: meatCategory.id,
    name: 'Шашлык с перцем',
  });
  await productRepository.updateDetails({
    description: 'Маринад с паприкой',
    id: firstProduct.id,
    isHit: true,
    isNew: false,
    weightGrams: 250,
  });
  const secondProduct = await productRepository.create({
    adminEnabled: true,
    basePriceMinor: 32_000,
    categoryId: vegetableCategory.id,
    name: 'Кабачок',
  });
  await productRepository.updateDetails({
    description: null,
    id: secondProduct.id,
    isHit: false,
    isNew: true,
    weightGrams: null,
  });
  const hiddenProduct = await productRepository.create({
    adminEnabled: false,
    basePriceMinor: 99_000,
    categoryId: meatCategory.id,
    name: 'Скрытый продукт',
  });

  const createServer = () =>
    createApiServer({
      adminIdentityResolver: createDevelopmentAdminIdentityResolver({
        enabled: true,
        runtime: 'test',
      }),
      categoryRepository,
      productRepository,
    });
  let server = createServer();
  await listenOnEphemeralPort(server);

  try {
    await closeServer(server);
    server = createServer();
    const reloadedPort = await listenOnEphemeralPort(server);
    const requests: string[] = [];
    const captureFetch = async (input: string, init?: RequestInit): Promise<Response> => {
      requests.push(input);
      return fetch(input, init);
    };
    const categoryClient = createCategoryApiClient({
      apiBaseUrl: `http://127.0.0.1:${reloadedPort}`,
      fetchImpl: captureFetch,
    });
    const productClient = createProductApiClient({
      apiBaseUrl: `http://127.0.0.1:${reloadedPort}`,
      fetchImpl: captureFetch,
    });

    const categories = await categoryClient.listCategories();
    const products = await productClient.listProducts();
    if (categories.kind !== 'loaded' || products.kind !== 'loaded') {
      assert.fail('Reloaded catalog did not load through the Mobile clients');
    }
    assert.equal(
      products.products.some((product) => product.id === hiddenProduct.id),
      false,
    );
    assert.deepEqual(
      searchCatalogProducts(products.products, categories.categories, ''),
      products.products,
    );

    assert.deepEqual(
      searchCatalogProducts(products.products, categories.categories, 'перцем').map(
        (product) => product.id,
      ),
      [firstProduct.id],
    );
    assert.deepEqual(
      searchCatalogProducts(products.products, categories.categories, 'паприкой').map(
        (product) => product.id,
      ),
      [firstProduct.id],
    );
    assert.deepEqual(
      searchCatalogProducts(products.products, categories.categories, 'овощи').map(
        (product) => product.id,
      ),
      [secondProduct.id],
    );
    assert.deepEqual(
      searchCatalogProducts(
        products.products,
        categories.categories,
        'паприкой',
        meatCategory.id,
      ).map((product) => product.id),
      [firstProduct.id],
    );

    assert.deepEqual(
      requests.map((request) => new URL(request).pathname),
      ['/categories', '/products'],
    );
    assert.equal(
      requests.every((request) => new URL(request).search === ''),
      true,
    );
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
  }
});

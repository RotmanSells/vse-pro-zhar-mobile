import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import {
  ApiErrorResponseSchema,
  ProductDetailsWithImageResponseSchema,
  ProductWithImageListResponseSchema,
  ProductWithImageResponseSchema,
} from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import type { ProductRepository } from '../../src/application/catalog/product.ts';
import { createImageMutationGuard } from '../../src/application/catalog/product-image.ts';
import {
  applyMigrations,
  backfillProductImages,
  ProductImageBackfillSourceMissingError,
} from '../../src/infrastructure/postgres/migrations.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { createSharpProductImageProcessor } from '../../src/infrastructure/image-processing/sharp-product-image-processor.ts';
import { createPostgresCategoryRepository } from '../../src/infrastructure/postgres/category-repository.ts';
import { createPostgresProductCategoryReferenceRepository } from '../../src/infrastructure/postgres/product-category-reference-repository.ts';
import { createPostgresProductRepository } from '../../src/infrastructure/postgres/product-repository.ts';
import { createTemporaryDirectoryObjectStorage } from '../../src/infrastructure/storage/temporary-directory-object-storage.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const adminHeaders = { 'x-vpzh-development-admin-identity': 'admin' };

async function image(color: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): Promise<Buffer> {
  return sharp({
    create: { channels: 3, background: color, height: 2, width: 2 },
  })
    .png()
    .toBuffer();
}

async function createProduct(
  port: number,
  category: string,
  bytes: Uint8Array,
  enabled = true,
): Promise<ReturnType<typeof ProductWithImageResponseSchema.parse>> {
  const blobBytes = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  blobBytes.set(bytes);
  const form = new FormData();
  form.set('categoryId', category);
  form.set('name', 'Шашлык с изображением');
  form.set('basePriceMinor', '45050');
  form.set('adminEnabled', String(enabled));
  form.set('image', new Blob([blobBytes], { type: 'image/png' }), '../../unsafe.png');
  const response = await fetch(`http://127.0.0.1:${port}/v2/admin/products`, {
    body: form,
    headers: adminHeaders,
    method: 'POST',
  });
  assert.equal(response.status, 201);
  return ProductWithImageResponseSchema.parse(await response.json());
}

async function replaceProduct(
  port: number,
  productId: string,
  bytes: Uint8Array,
): Promise<ReturnType<typeof ProductWithImageResponseSchema.parse>> {
  const blobBytes = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  blobBytes.set(bytes);
  const form = new FormData();
  form.set(
    'image',
    new Blob([blobBytes], { type: 'application/octet-stream' }),
    'not-an-image.webp',
  );
  const response = await fetch(`http://127.0.0.1:${port}/v2/admin/products/${productId}/image`, {
    body: form,
    headers: adminHeaders,
    method: 'PUT',
  });
  assert.equal(response.status, 200);
  return ProductWithImageResponseSchema.parse(await response.json());
}

await test('real v2 Product imagery persists, enforces visibility, supports ETag and replacement', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool, { includeContract: false });
  const categoryRepository = createPostgresCategoryRepository(database.pool);
  const category = await categoryRepository.create({ name: 'Изображения' });
  const productRepository = createPostgresProductRepository(database.pool);
  const categoryReferenceRepository = createPostgresProductCategoryReferenceRepository(
    database.pool,
  );
  const storageDirectory = await mkdtemp(join(tmpdir(), 'vpzh-product-image-integration-'));
  const objectStorage = createTemporaryDirectoryObjectStorage(storageDirectory);
  const processor = createSharpProductImageProcessor();
  const createServer = () =>
    createApiServer({
      adminIdentityResolver: createDevelopmentAdminIdentityResolver({
        enabled: true,
        runtime: 'test',
      }),
      imageMutationGuard: createImageMutationGuard(),
      imageProcessor: processor,
      objectStorage,
      productCategoryReferenceRepository: categoryReferenceRepository,
      productRepository,
      publicApiBaseUrl: 'http://127.0.0.1',
    });
  const server = createServer();
  const port = await listenOnEphemeralPort(server);
  try {
    const created = await createProduct(port, category.id, await image({ b: 30, g: 20, r: 220 }));
    const list = await fetch(`http://127.0.0.1:${port}/v2/products`);
    assert.deepEqual(ProductWithImageListResponseSchema.parse(await list.json()), [created]);
    const details = await fetch(`http://127.0.0.1:${port}/v2/products/${created.id}`);
    assert.deepEqual(ProductDetailsWithImageResponseSchema.parse(await details.json()), {
      ...created,
      categoryName: 'Изображения',
    });

    const imagePath = new URL(created.imageUrl).pathname;
    const imageResponse = await fetch(`http://127.0.0.1:${port}${imagePath}`);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
    assert.equal(imageResponse.headers.get('cache-control'), 'private, no-cache');
    assert.equal(
      imageResponse.headers.get('etag'),
      `"${new URL(created.imageUrl).pathname.split('/').at(-1)}"`,
    );
    const cached = await fetch(`http://127.0.0.1:${port}${imagePath}`, {
      headers: { 'if-none-match': imageResponse.headers.get('etag') ?? '' },
    });
    assert.equal(cached.status, 304);

    const replaced = await replaceProduct(port, created.id, await image({ b: 220, g: 20, r: 30 }));
    assert.notEqual(replaced.imageUrl, created.imageUrl);
    const oldImage = await fetch(`http://127.0.0.1:${port}${imagePath}`);
    assert.equal(oldImage.status, 404);
    const newImagePath = new URL(replaced.imageUrl).pathname;
    assert.equal((await fetch(`http://127.0.0.1:${port}${newImagePath}`)).status, 200);

    const hidden = await createProduct(
      port,
      category.id,
      await image({ b: 30, g: 220, r: 30 }),
      false,
    );
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}${new URL(hidden.imageUrl).pathname}`)).status,
      404,
    );
    assert.deepEqual(
      ProductWithImageListResponseSchema.parse(
        await (await fetch(`http://127.0.0.1:${port}/v2/products`)).json(),
      ),
      [replaced],
    );

    await closeServer(server);
    await applyMigrations(database.pool);
    const reloadedServer = createServer();
    const reloadedPort = await listenOnEphemeralPort(reloadedServer);
    try {
      const reloaded = await fetch(`http://127.0.0.1:${reloadedPort}/v2/products/${created.id}`);
      assert.equal(reloaded.status, 200);
      assert.equal(
        ProductDetailsWithImageResponseSchema.parse(await reloaded.json()).imageUrl,
        replaced.imageUrl,
      );
    } finally {
      await closeServer(reloadedServer);
    }
  } finally {
    if (server.listening) await closeServer(server);
    await database.cleanup();
    await rm(storageDirectory, { force: true, recursive: true });
  }
});

await test('failed image processing returns a safe error and does not create a Product', async () => {
  const productRepository: ProductRepository = {
    create: () => Promise.reject(new Error('persistence must not run')),
    findByIdForImage: () => Promise.resolve(undefined),
    findVisibleById: () => Promise.resolve(undefined),
    listAll: () => Promise.resolve([]),
    listVisible: () => Promise.resolve([]),
    setImageRevisionIfCurrent: () => Promise.resolve(undefined),
    updateDetails: () => Promise.resolve(undefined),
    updateVisibility: () => Promise.resolve(undefined),
  };
  const storageDirectory = await mkdtemp(join(tmpdir(), 'vpzh-product-image-failure-'));
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    productCategoryReferenceRepository: { exists: () => Promise.resolve(true) },
    imageMutationGuard: createImageMutationGuard(),
    imageProcessor: {
      process: () => Promise.reject(new Error('decoder detail')),
    },
    objectStorage: createTemporaryDirectoryObjectStorage(storageDirectory),
    productRepository,
  });
  const port = await listenOnEphemeralPort(server);
  try {
    const form = new FormData();
    form.set('categoryId', categoryId);
    form.set('name', 'Invalid');
    form.set('basePriceMinor', '100');
    form.set('adminEnabled', 'true');
    form.set('image', new Blob([new Uint8Array([1])]), 'image.png');
    const response = await fetch(`http://127.0.0.1:${port}/v2/admin/products`, {
      body: form,
      headers: adminHeaders,
      method: 'POST',
    });
    assert.equal(response.status, 422);
    const error = ApiErrorResponseSchema.parse(await response.json());
    assert.deepEqual(error.error, { code: 'INVALID_IMAGE', message: 'Invalid image' });
  } finally {
    await closeServer(server);
    await rm(storageDirectory, { force: true, recursive: true });
  }
});

await test('006 backfill requires every approved source before writing and unlocks 007 only after CAS', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool, { includeContract: false });
  const category = await createPostgresCategoryRepository(database.pool).create({
    name: 'Backfill',
  });
  const repository = createPostgresProductRepository(database.pool);
  const legacy = await repository.create({
    adminEnabled: true,
    basePriceMinor: 100,
    categoryId: category.id,
    name: 'Legacy image Product',
  });
  const storageDirectory = await mkdtemp(join(tmpdir(), 'vpzh-product-image-backfill-'));
  const storage = createTemporaryDirectoryObjectStorage(storageDirectory);
  const processor = createSharpProductImageProcessor();
  try {
    await assert.rejects(
      () =>
        backfillProductImages({
          imageProcessor: processor,
          objectStorage: storage,
          pool: database.pool,
          sourceImage: () => Promise.resolve(undefined),
        }),
      ProductImageBackfillSourceMissingError,
    );
    const missing = await database.pool.query<{ readonly image_revision: string | null }>(
      'SELECT image_revision FROM products WHERE id = $1',
      [legacy.id],
    );
    assert.equal(missing.rows[0]?.image_revision, null);
    const source = await image({ b: 30, g: 20, r: 220 });
    assert.equal(
      await backfillProductImages({
        imageProcessor: processor,
        imageRevisionGenerator: () => 'b6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        objectStorage: storage,
        pool: database.pool,
        sourceImage: () => Promise.resolve(source),
      }),
      1,
    );
    const completed = await database.pool.query<{ readonly image_revision: string | null }>(
      'SELECT image_revision FROM products WHERE id = $1',
      [legacy.id],
    );
    assert.equal(completed.rows[0]?.image_revision, 'b6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047');
    await applyMigrations(database.pool);
  } finally {
    await database.cleanup();
    await rm(storageDirectory, { force: true, recursive: true });
  }
});

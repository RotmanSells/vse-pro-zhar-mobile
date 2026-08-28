import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProductWithImage,
  replaceProductImage,
  type ObjectStorage,
  type ProductImageProcessor,
} from '../../src/application/catalog/product-image.ts';
import type {
  ProductCategoryReferenceRepository,
  ProductRepository,
} from '../../src/application/catalog/product.ts';
import type { Product } from '../../src/domain/catalog/product.ts';

const admin = {
  kind: 'development_admin',
  role: 'admin',
  subject: 'development-admin',
} as const;
const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const oldRevision = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const newRevision = 'b6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';

function product(imageRevision: string | null): Product {
  return {
    adminEnabled: true,
    basePriceMinor: 1_000,
    categoryId,
    description: null,
    id: productId,
    imageRevision,
    isHit: false,
    isNew: false,
    name: 'Шашлык',
    weightGrams: null,
  };
}

function processor(): ProductImageProcessor {
  return {
    process: (input) =>
      Promise.resolve({ contentType: 'image/webp' as const, data: new Uint8Array(input) }),
  };
}

function storage(events: string[]): ObjectStorage {
  return {
    delete: ({ key }) => {
      events.push(`delete:${key}`);
      return Promise.resolve();
    },
    get: ({ key }) => Promise.resolve(new Uint8Array([key.length])),
    put: ({ key }) => {
      events.push(`put:${key}`);
      return Promise.resolve();
    },
  };
}

const categoryReference: ProductCategoryReferenceRepository = {
  exists: () => Promise.resolve(true),
};

await test('image create uploads first and persists the opaque revision only after storage succeeds', async () => {
  const events: string[] = [];
  const repository: ProductRepository = {
    create: (input) => {
      events.push('create');
      return Promise.resolve(product(input.imageRevision ?? null));
    },
    findVisibleById: () => Promise.resolve(undefined),
    listAll: () => Promise.resolve([]),
    listVisible: () => Promise.resolve([]),
    updateDetails: () => Promise.resolve(undefined),
    updateVisibility: () => Promise.resolve(undefined),
  };
  const result = await createProductWithImage({
    categoryReferenceRepository: categoryReference,
    image: new Uint8Array([1]),
    imageProcessor: processor(),
    imageRevisionGenerator: () => oldRevision,
    objectStorage: storage(events),
    principal: admin,
    product: { adminEnabled: true, basePriceMinor: 1_000, categoryId, name: ' Шашлык ' },
    productIdGenerator: () => productId,
    repository,
  });
  assert.equal(result.imageRevision, oldRevision);
  assert.deepEqual(events, [`put:product-images/${productId}/${oldRevision}.webp`, 'create']);
});

await test('replacement cleans a concurrent loser and never deletes the confirmed old image', async () => {
  const events: string[] = [];
  const repository: ProductRepository = {
    create: () => Promise.resolve(product(oldRevision)),
    findByIdForImage: () => Promise.resolve(product(oldRevision)),
    findVisibleById: () => Promise.resolve(undefined),
    listAll: () => Promise.resolve([]),
    listVisible: () => Promise.resolve([]),
    setImageRevisionIfCurrent: () => Promise.resolve(undefined),
    updateDetails: () => Promise.resolve(undefined),
    updateVisibility: () => Promise.resolve(undefined),
  };
  await assert.rejects(
    () =>
      replaceProductImage({
        image: new Uint8Array([1]),
        imageProcessor: processor(),
        imageRevisionGenerator: () => newRevision,
        objectStorage: storage(events),
        principal: admin,
        productId,
        repository,
      }),
    { name: 'ProductImageConflictError' },
  );
  assert.deepEqual(events, [
    `put:product-images/${productId}/${newRevision}.webp`,
    `delete:product-images/${productId}/${newRevision}.webp`,
  ]);
});

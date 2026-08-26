import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductCategoryNotFoundError,
  createProduct,
  type ProductCategoryReferenceRepository,
  type ProductRepository,
} from '../../src/application/catalog/product.ts';
import type { Product } from '../../src/domain/catalog/product.ts';

const admin = {
  kind: 'development_admin',
  role: 'admin',
  subject: 'development-admin',
} as const;
const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const product: Product = {
  adminEnabled: true,
  basePriceMinor: 45_000,
  categoryId,
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  name: 'Шашлык',
};

function createRepository() {
  let created: Product | undefined;
  const repository: ProductRepository = {
    create: (input) => {
      created = { id: product.id, ...input };
      return Promise.resolve(created);
    },
    listVisible: () => Promise.resolve(created === undefined ? [] : [created]),
  };
  const categoryReferenceRepository: ProductCategoryReferenceRepository = {
    exists: (id) => Promise.resolve(id === categoryId),
  };
  return { categoryReferenceRepository, getCreated: () => created, repository };
}

await test('create Product validates the existing Category before persistence', async () => {
  const state = createRepository();
  await assert.rejects(
    createProduct(
      admin,
      {
        adminEnabled: true,
        basePriceMinor: 45_000,
        categoryId: 'a9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Шашлык',
      },
      state.repository,
      state.categoryReferenceRepository,
    ),
    ProductCategoryNotFoundError,
  );
  assert.equal(state.getCreated(), undefined);
});

await test('create Product preserves valid fields and explicit disabled visibility', async () => {
  const state = createRepository();
  const created = await createProduct(
    admin,
    { adminEnabled: false, basePriceMinor: 45_050, categoryId, name: '  Шашлык  ' },
    state.repository,
    state.categoryReferenceRepository,
  );
  assert.deepEqual(created, { ...product, adminEnabled: false, basePriceMinor: 45_050 });
});

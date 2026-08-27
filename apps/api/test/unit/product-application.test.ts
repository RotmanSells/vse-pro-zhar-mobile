import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductCategoryNotFoundError,
  createProduct,
  updateProductDetails,
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
  description: null,
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  isHit: false,
  isNew: false,
  name: 'Шашлык',
  weightGrams: null,
};

function createRepository() {
  let created: Product | undefined;
  const repository: ProductRepository = {
    create: (input) => {
      created = {
        description: null,
        id: product.id,
        isHit: false,
        isNew: false,
        weightGrams: null,
        ...input,
      };
      return Promise.resolve(created);
    },
    listVisible: () => Promise.resolve(created === undefined ? [] : [created]),
    updateDetails: (input) => {
      if (created === undefined || created.id !== input.id) return Promise.resolve(undefined);
      created = { ...created, ...input };
      return Promise.resolve(created);
    },
    findVisibleById: () =>
      Promise.resolve(
        created === undefined ? undefined : { categoryName: 'Шашлык', product: created },
      ),
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

await test('update Product details preserves existing catalog fields', async () => {
  const state = createRepository();
  await createProduct(
    admin,
    { adminEnabled: true, basePriceMinor: 45_000, categoryId, name: 'Шашлык' },
    state.repository,
    state.categoryReferenceRepository,
  );
  await assert.doesNotReject(
    updateProductDetails(
      admin,
      {
        description: 'Состав блюда',
        id: product.id,
        isHit: true,
        isNew: true,
        weightGrams: 350,
      },
      state.repository,
    ),
  );
  assert.deepEqual(state.getCreated(), {
    ...product,
    description: 'Состав блюда',
    isHit: true,
    isNew: true,
    weightGrams: 350,
  });
});

await test('update Product details checks the named permission before persistence', async () => {
  const state = createRepository();
  state.repository.updateDetails = () =>
    Promise.reject(new Error('persistence must not be called'));
  await assert.rejects(
    updateProductDetails(
      { kind: 'development_admin', role: 'viewer', subject: 'development-admin' },
      {
        description: 'Состав блюда',
        id: product.id,
        isHit: true,
        isNew: false,
        weightGrams: 350,
      },
      state.repository,
    ),
    /Product update permission/u,
  );
});

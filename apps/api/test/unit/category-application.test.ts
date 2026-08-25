import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATEGORY_CREATE_OPERATION,
  CategoryAuthorizationError,
  createCategory,
  listCategories,
  type AdminPrincipal,
} from '../../src/application/catalog/category.ts';
import type { Category } from '../../src/domain/catalog/category.ts';

const admin: AdminPrincipal = {
  kind: 'development_admin',
  subject: 'development-admin',
  role: 'admin',
};

function createRepository() {
  const categories: Category[] = [];
  return {
    categories,
    create(input: { readonly name: string }): Promise<Category> {
      const category = { id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', ...input };
      categories.push(category);
      return Promise.resolve(category);
    },
    list(): Promise<readonly Category[]> {
      return Promise.resolve(categories);
    },
  };
}

await test('create Category authorizes before calling the repository', async () => {
  const repository = createRepository();
  const category = await createCategory(admin, { name: '  Супы  ' }, repository);

  assert.deepEqual(category, {
    id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    name: 'Супы',
  });
  assert.equal(CATEGORY_CREATE_OPERATION, 'category:create');
});

await test('create Category rejects a principal without the named permission', async () => {
  const repository = createRepository();
  const insufficientPrincipal: AdminPrincipal = {
    kind: 'development_admin',
    subject: 'development-admin',
    role: 'viewer',
  };

  await assert.rejects(
    createCategory(insufficientPrincipal, { name: 'Супы' }, repository),
    CategoryAuthorizationError,
  );
  assert.deepEqual(repository.categories, []);
});

await test('list Categories reads the repository without requiring an identity', async () => {
  const repository = createRepository();
  repository.categories.push({ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' });

  assert.deepEqual(await listCategories(repository), repository.categories);
});

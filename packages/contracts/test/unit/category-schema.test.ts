import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
} from '../../src/category.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Category contracts trim a valid name and preserve only id/name', () => {
  assert.deepEqual(CreateCategoryRequestSchema.parse({ name: '  Супы  ' }), {
    name: 'Супы',
  });
  assert.deepEqual(CategoryResponseSchema.parse({ id: categoryId, name: 'Супы' }), {
    id: categoryId,
    name: 'Супы',
  });
  assert.deepEqual(CategoryListResponseSchema.parse([{ id: categoryId, name: 'Супы' }]), [
    { id: categoryId, name: 'Супы' },
  ]);
});

await test('Category request rejects blank and overlong names', () => {
  assert.throws(() => CreateCategoryRequestSchema.parse({ name: '   ' }));
  assert.throws(() => CreateCategoryRequestSchema.parse({ name: 'x'.repeat(201) }));
  assert.throws(() => CreateCategoryRequestSchema.parse({ name: 'Супы', slug: 'soups' }));
});

await test('Category contracts do not reject duplicate names', () => {
  assert.doesNotThrow(() =>
    CategoryListResponseSchema.parse([
      { id: categoryId, name: 'Супы' },
      { id: '73a8e5f4-5f68-46a3-bc61-3c2d75ac6db1', name: 'Супы' },
    ]),
  );
});

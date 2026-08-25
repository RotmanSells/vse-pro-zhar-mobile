import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CategoryNameValidationError,
  createCategory,
  normalizeCategoryName,
} from '../../src/domain/catalog/category.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Category domain trims a valid name', () => {
  assert.equal(normalizeCategoryName('  Супы  '), 'Супы');
  assert.deepEqual(createCategory({ id: categoryId, name: '  Супы  ' }), {
    id: categoryId,
    name: 'Супы',
  });
});

await test('Category domain rejects a name that is empty after trimming', () => {
  assert.throws(() => normalizeCategoryName('   '), CategoryNameValidationError);
});

await test('Category domain rejects names longer than 200 characters after trimming', () => {
  assert.throws(() => normalizeCategoryName(` ${'x'.repeat(201)} `), CategoryNameValidationError);
});

await test('Category domain permits duplicate names', () => {
  assert.doesNotThrow(() => normalizeCategoryName('Супы'));
  assert.doesNotThrow(() => normalizeCategoryName('Супы'));
});

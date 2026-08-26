import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductBasePriceValidationError,
  ProductNameValidationError,
  createProduct,
  normalizeProductBasePriceMinor,
  normalizeProductName,
} from '../../src/domain/catalog/product.ts';

const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Product domain trims a valid name and keeps explicit visibility', () => {
  assert.deepEqual(
    createProduct({
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      id: productId,
      name: '  Шашлык  ',
    }),
    {
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      id: productId,
      name: 'Шашлык',
    },
  );
});

await test('Product domain validates name length and positive integer minor units', () => {
  assert.throws(() => normalizeProductName('   '), ProductNameValidationError);
  assert.throws(() => normalizeProductName('x'.repeat(201)), ProductNameValidationError);
  assert.throws(() => normalizeProductBasePriceMinor(0), ProductBasePriceValidationError);
  assert.throws(() => normalizeProductBasePriceMinor(450.5), ProductBasePriceValidationError);
  assert.throws(
    () => normalizeProductBasePriceMinor(2_147_483_648),
    ProductBasePriceValidationError,
  );
});

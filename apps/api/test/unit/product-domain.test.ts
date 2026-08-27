import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductBasePriceValidationError,
  ProductDescriptionValidationError,
  ProductNameValidationError,
  ProductWeightValidationError,
  createProduct,
  normalizeProductBasePriceMinor,
  normalizeProductDescription,
  normalizeProductName,
  normalizeProductWeightGrams,
} from '../../src/domain/catalog/product.ts';

const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Product domain trims a valid name and keeps explicit visibility', () => {
  assert.deepEqual(
    createProduct({
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      description: null,
      id: productId,
      isHit: false,
      isNew: false,
      name: '  Шашлык  ',
      weightGrams: null,
    }),
    {
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      description: null,
      id: productId,
      isHit: false,
      isNew: false,
      name: 'Шашлык',
      weightGrams: null,
    },
  );
});

await test('Product domain normalizes optional details and validates their invariants', () => {
  assert.equal(normalizeProductDescription('  Состав блюда  '), 'Состав блюда');
  assert.equal(normalizeProductDescription('   '), null);
  assert.equal(normalizeProductDescription(null), null);
  assert.throws(
    () => normalizeProductDescription('x'.repeat(501)),
    ProductDescriptionValidationError,
  );
  assert.equal(normalizeProductWeightGrams(350), 350);
  assert.equal(normalizeProductWeightGrams(null), null);
  assert.throws(() => normalizeProductWeightGrams(0), ProductWeightValidationError);
  assert.throws(() => normalizeProductWeightGrams(1.5), ProductWeightValidationError);
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

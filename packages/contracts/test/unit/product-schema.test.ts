import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CreateProductRequestSchema,
  ProductDetailsResponseSchema,
  ProductResponseSchema,
  UpdateProductDetailsRequestSchema,
} from '../../src/product.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Product contracts accept strict shape with integer RUB minor units and explicit visibility', () => {
  assert.deepEqual(
    ProductResponseSchema.parse({
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      description: null,
      id: productId,
      isHit: false,
      isNew: false,
      name: 'Шашлык',
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

await test('Product contracts reject missing explicit visibility, unsafe prices and unknown fields', () => {
  assert.equal(
    CreateProductRequestSchema.safeParse({
      basePriceMinor: 450,
      categoryId,
      name: 'Шашлык',
    }).success,
    false,
  );
  assert.equal(
    UpdateProductDetailsRequestSchema.safeParse({
      description: 'Состав',
      isHit: true,
      isNew: false,
      weightGrams: 350,
    }).success,
    true,
  );
  assert.equal(
    UpdateProductDetailsRequestSchema.safeParse({
      description: 'Состав',
      id: productId,
      isHit: true,
      isNew: false,
      weightGrams: 350,
    }).success,
    false,
  );
  assert.equal(
    ProductDetailsResponseSchema.safeParse({
      adminEnabled: true,
      basePriceMinor: 450,
      categoryId,
      categoryName: 'Шашлык',
      description: null,
      id: productId,
      isHit: false,
      isNew: false,
      name: 'Шашлык',
      weightGrams: null,
    }).success,
    true,
  );
  assert.equal(
    ProductResponseSchema.safeParse({
      adminEnabled: true,
      basePriceMinor: 450,
      categoryId,
      description: 'x'.repeat(501),
      id: productId,
      isHit: false,
      isNew: false,
      name: 'Шашлык',
      weightGrams: null,
    }).success,
    false,
  );
  assert.equal(
    CreateProductRequestSchema.safeParse({
      adminEnabled: true,
      basePriceMinor: 450.5,
      categoryId,
      name: 'Шашлык',
    }).success,
    false,
  );
  assert.equal(
    CreateProductRequestSchema.safeParse({
      adminEnabled: true,
      basePriceMinor: 450,
      categoryId,
      name: 'Шашлык',
      orderable: true,
    }).success,
    false,
  );
});

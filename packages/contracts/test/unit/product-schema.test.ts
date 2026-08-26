import assert from 'node:assert/strict';
import test from 'node:test';

import { CreateProductRequestSchema, ProductResponseSchema } from '../../src/product.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';

await test('Product contracts accept strict shape with integer RUB minor units and explicit visibility', () => {
  assert.deepEqual(
    ProductResponseSchema.parse({
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId,
      id: productId,
      name: 'Шашлык',
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

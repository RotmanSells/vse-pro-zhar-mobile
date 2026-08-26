'use server';

import { createProduct } from '../../src/main';
import type { CreateProductResult } from '../../src/application/catalog/product';

export async function createProductAction(input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
}): Promise<CreateProductResult> {
  return createProduct(input);
}

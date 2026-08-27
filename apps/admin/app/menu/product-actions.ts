'use server';

import { createProduct, listProducts, updateProductDetails } from '../../src/main';
import type {
  CreateProductResult,
  LoadProductsResult,
  UpdateProductDetailsResult,
} from '../../src/application/catalog/product';

export async function createProductAction(input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
}): Promise<CreateProductResult> {
  return createProduct(input);
}

export async function listProductsAction(): Promise<LoadProductsResult> {
  return listProducts();
}

export async function updateProductDetailsAction(input: {
  readonly id: string;
  readonly description: string;
  readonly weightGrams: string;
  readonly isNew: boolean;
  readonly isHit: boolean;
}): Promise<UpdateProductDetailsResult> {
  return updateProductDetails(input);
}

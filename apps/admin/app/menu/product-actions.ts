'use server';

import {
  createProduct,
  listProducts,
  replaceProductImage,
  updateProductVisibility,
  updateProductDetails,
} from '../../src/main';
import type {
  CreateProductResult,
  LoadProductsResult,
  UpdateProductDetailsResult,
  UpdateProductImageResult,
  UpdateProductVisibilityResult,
} from '../../src/application/catalog/product';

export async function createProductAction(input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
  readonly image?: Blob;
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

export async function updateProductVisibilityAction(input: {
  readonly id: string;
  readonly adminEnabled: boolean;
}): Promise<UpdateProductVisibilityResult> {
  return updateProductVisibility(input);
}

export async function replaceProductImageAction(input: {
  readonly id: string;
  readonly image?: Blob;
}): Promise<UpdateProductImageResult> {
  return replaceProductImage(input);
}

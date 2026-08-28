import {
  loadCategories,
  submitCategory,
  type CreateCategoryResult,
  type ListCategoriesResult,
} from './application/catalog/category';
import {
  loadProducts,
  submitProduct,
  submitProductDetails,
  submitProductImage,
  submitProductVisibility,
  type CreateProductResult,
  type LoadProductsResult,
  type UpdateProductDetailsResult,
  type UpdateProductImageResult,
  type UpdateProductVisibilityResult,
} from './application/catalog/product';
import {
  createCategoryApiClient,
  type CreateCategoryApiClientOptions,
} from './infrastructure/catalog/category-api-client';
import {
  createProductApiClient,
  type CreateProductApiClientOptions,
} from './infrastructure/catalog/product-api-client';

export type AdminCategoryOperation = (input: {
  readonly name: string;
}) => Promise<CreateCategoryResult>;

export function createAdminCategoryOperation(
  options: CreateCategoryApiClientOptions = {},
): AdminCategoryOperation {
  const categoryPort = createCategoryApiClient(options);
  return (input) => submitCategory(input, categoryPort);
}

export function createCategory(input: { readonly name: string }): Promise<CreateCategoryResult> {
  return createAdminCategoryOperation()(input);
}

export function createAdminCategoryListOperation(
  options: CreateCategoryApiClientOptions = {},
): () => Promise<ListCategoriesResult> {
  const categoryPort = createCategoryApiClient(options);
  return () => loadCategories(categoryPort);
}

export function listCategories(): Promise<ListCategoriesResult> {
  return createAdminCategoryListOperation()();
}

export type AdminProductOperation = (input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
  readonly image?: Blob;
}) => Promise<CreateProductResult>;

export function createAdminProductOperation(
  options: CreateProductApiClientOptions = {},
): AdminProductOperation {
  const productPort = createProductApiClient(options);
  return (input) => submitProduct(input, productPort);
}

export function createProduct(input: {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceRub: string;
  readonly adminEnabled: boolean;
  readonly image?: Blob;
}): Promise<CreateProductResult> {
  return createAdminProductOperation()(input);
}

export type AdminProductListOperation = () => Promise<LoadProductsResult>;

export function createAdminProductListOperation(
  options: CreateProductApiClientOptions = {},
): AdminProductListOperation {
  const productPort = createProductApiClient(options);
  return () => loadProducts(productPort);
}

export function listProducts(): Promise<LoadProductsResult> {
  return createAdminProductListOperation()();
}

export type AdminProductDetailsOperation = (input: {
  readonly id: string;
  readonly description: string;
  readonly weightGrams: string;
  readonly isNew: boolean;
  readonly isHit: boolean;
}) => Promise<UpdateProductDetailsResult>;

export function createAdminProductDetailsOperation(
  options: CreateProductApiClientOptions = {},
): AdminProductDetailsOperation {
  const productPort = createProductApiClient(options);
  return (input) => submitProductDetails(input, productPort);
}

export function updateProductDetails(input: {
  readonly id: string;
  readonly description: string;
  readonly weightGrams: string;
  readonly isNew: boolean;
  readonly isHit: boolean;
}): Promise<UpdateProductDetailsResult> {
  return createAdminProductDetailsOperation()(input);
}

export type AdminProductVisibilityOperation = (input: {
  readonly id: string;
  readonly adminEnabled: boolean;
}) => Promise<UpdateProductVisibilityResult>;

export function createAdminProductVisibilityOperation(
  options: CreateProductApiClientOptions = {},
): AdminProductVisibilityOperation {
  const productPort = createProductApiClient(options);
  return (input) => submitProductVisibility(input, productPort);
}

export function updateProductVisibility(input: {
  readonly id: string;
  readonly adminEnabled: boolean;
}): Promise<UpdateProductVisibilityResult> {
  return createAdminProductVisibilityOperation()(input);
}

export type AdminProductImageOperation = (input: {
  readonly id: string;
  readonly image?: Blob;
}) => Promise<UpdateProductImageResult>;

export function createAdminProductImageOperation(
  options: CreateProductApiClientOptions = {},
): AdminProductImageOperation {
  const productPort = createProductApiClient(options);
  return (input) => submitProductImage(input, productPort);
}

export function replaceProductImage(input: {
  readonly id: string;
  readonly image?: Blob;
}): Promise<UpdateProductImageResult> {
  return createAdminProductImageOperation()(input);
}

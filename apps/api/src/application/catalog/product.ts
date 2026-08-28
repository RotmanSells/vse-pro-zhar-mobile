import type { AdminPrincipal } from '../admin-authorization.ts';
import {
  assertCanCreateProduct,
  assertCanUpdateProduct,
  assertCanUpdateProductVisibility,
  PRODUCT_CREATE_OPERATION,
  PRODUCT_UPDATE_OPERATION,
  PRODUCT_VISIBILITY_UPDATE_OPERATION,
  ProductAuthorizationError,
  ProductUpdateAuthorizationError,
  ProductVisibilityUpdateAuthorizationError,
} from '../admin-authorization.ts';
import {
  createProduct as createDomainProduct,
  normalizeProductDescription,
  normalizeProductCategoryId,
  normalizeProductBasePriceMinor,
  normalizeProductId,
  normalizeProductName,
  normalizeProductWeightGrams,
  type Product,
  ProductIdValidationError,
} from '../../domain/catalog/product.ts';
export {
  PRODUCT_CREATE_OPERATION,
  PRODUCT_UPDATE_OPERATION,
  PRODUCT_VISIBILITY_UPDATE_OPERATION,
  ProductAuthorizationError,
  ProductUpdateAuthorizationError,
  ProductVisibilityUpdateAuthorizationError,
};
export type { AdminPrincipal } from '../admin-authorization.ts';
export class ProductCategoryNotFoundError extends Error {
  constructor() {
    super('Product category was not found');
    this.name = 'ProductCategoryNotFoundError';
  }
}
export class ProductNotFoundError extends Error {
  constructor() {
    super('Product was not found');
    this.name = 'ProductNotFoundError';
  }
}
export interface ProductDetails {
  readonly product: Product;
  readonly categoryName: string;
}
export interface ProductRepository {
  create(input: {
    readonly id?: string;
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
    readonly imageRevision?: string | null;
  }): Promise<Product>;
  updateDetails(input: {
    readonly id: string;
    readonly description: string | null;
    readonly weightGrams: number | null;
    readonly isNew: boolean;
    readonly isHit: boolean;
  }): Promise<Product | undefined>;
  updateVisibility(input: {
    readonly id: string;
    readonly adminEnabled: boolean;
  }): Promise<Product | undefined>;
  listAll(): Promise<readonly Product[]>;
  listVisible(): Promise<readonly Product[]>;
  findVisibleById(id: string): Promise<ProductDetails | undefined>;
  findByIdForImage?(id: string): Promise<Product | undefined>;
  setImageRevisionIfCurrent?(input: {
    readonly id: string;
    readonly expectedImageRevision: string | null;
    readonly imageRevision: string;
  }): Promise<Product | undefined>;
}
export interface ProductCategoryReferenceRepository {
  exists(categoryId: string): Promise<boolean>;
}
export async function createProduct(
  principal: AdminPrincipal,
  input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
  },
  repository: ProductRepository,
  categoryReferenceRepository: ProductCategoryReferenceRepository,
): Promise<Product> {
  assertCanCreateProduct(principal);
  const normalizedInput = {
    categoryId: normalizeProductCategoryId(input.categoryId),
    name: normalizeProductName(input.name),
    basePriceMinor: normalizeProductBasePriceMinor(input.basePriceMinor),
    adminEnabled: input.adminEnabled,
  };
  if (!(await categoryReferenceRepository.exists(normalizedInput.categoryId))) {
    throw new ProductCategoryNotFoundError();
  }
  return repository.create(normalizedInput);
}
export async function updateProductDetails(
  principal: AdminPrincipal,
  input: {
    readonly id: string;
    readonly description: string | null;
    readonly weightGrams: number | null;
    readonly isNew: boolean;
    readonly isHit: boolean;
  },
  repository: ProductRepository,
): Promise<Product> {
  assertCanUpdateProduct(principal);
  let productId: string;
  try {
    productId = normalizeProductId(input.id, 'id');
  } catch (error) {
    if (error instanceof ProductIdValidationError) throw new ProductNotFoundError();
    throw error;
  }
  const updated = await repository.updateDetails({
    description: normalizeProductDescription(input.description),
    id: productId,
    isHit: input.isHit,
    isNew: input.isNew,
    weightGrams: normalizeProductWeightGrams(input.weightGrams),
  });
  if (updated === undefined) throw new ProductNotFoundError();
  return createDomainProduct(updated);
}
export async function listProducts(repository: ProductRepository): Promise<readonly Product[]> {
  return repository.listVisible();
}

export async function listAdminProducts(
  repository: ProductRepository,
): Promise<readonly Product[]> {
  return repository.listAll();
}

export async function updateProductVisibility(
  principal: AdminPrincipal,
  input: { readonly id: string; readonly adminEnabled: boolean },
  repository: ProductRepository,
): Promise<Product> {
  assertCanUpdateProductVisibility(principal);
  let productId: string;
  try {
    productId = normalizeProductId(input.id, 'id');
  } catch (error) {
    if (error instanceof ProductIdValidationError) throw new ProductNotFoundError();
    throw error;
  }
  const updated = await repository.updateVisibility({
    adminEnabled: input.adminEnabled,
    id: productId,
  });
  if (updated === undefined) throw new ProductNotFoundError();
  return createDomainProduct(updated);
}
export async function getVisibleProductDetails(
  id: string,
  repository: ProductRepository,
): Promise<ProductDetails | undefined> {
  try {
    return repository.findVisibleById(normalizeProductId(id, 'id'));
  } catch (error) {
    if (error instanceof ProductIdValidationError) throw new ProductNotFoundError();
    throw error;
  }
}
export function validateCreatedProduct(product: Product): Product {
  return createDomainProduct(product);
}

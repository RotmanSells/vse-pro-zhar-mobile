import type { AdminPrincipal } from '../admin-authorization.ts';
import {
  assertCanCreateProduct,
  PRODUCT_CREATE_OPERATION,
  ProductAuthorizationError,
} from '../admin-authorization.ts';
import {
  createProduct as createDomainProduct,
  normalizeProductCategoryId,
  normalizeProductBasePriceMinor,
  normalizeProductName,
  type Product,
} from '../../domain/catalog/product.ts';
export { PRODUCT_CREATE_OPERATION, ProductAuthorizationError };
export type { AdminPrincipal } from '../admin-authorization.ts';
export class ProductCategoryNotFoundError extends Error {
  constructor() {
    super('Product category was not found');
    this.name = 'ProductCategoryNotFoundError';
  }
}
export interface ProductRepository {
  create(input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
  }): Promise<Product>;
  listVisible(): Promise<readonly Product[]>;
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
export async function listProducts(repository: ProductRepository): Promise<readonly Product[]> {
  return repository.listVisible();
}
export function validateCreatedProduct(product: Product): Product {
  return createDomainProduct(product);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_BASE_PRICE_MINOR_MAX = 2_147_483_647;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
export const PRODUCT_WEIGHT_GRAMS_MAX = 2_147_483_647;
export interface Product {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceMinor: number;
  readonly adminEnabled: boolean;
  readonly description: string | null;
  readonly weightGrams: number | null;
  readonly isNew: boolean;
  readonly isHit: boolean;
}
export class ProductNameValidationError extends Error {
  constructor() {
    super('Product name must contain between 1 and 200 characters after trimming');
    this.name = 'ProductNameValidationError';
  }
}
export class ProductIdValidationError extends Error {
  constructor(field: 'id' | 'categoryId') {
    super(`Product ${field} must be a UUID`);
    this.name = 'ProductIdValidationError';
  }
}
export class ProductBasePriceValidationError extends Error {
  constructor() {
    super('Product base price must be a positive integer number of RUB minor units');
    this.name = 'ProductBasePriceValidationError';
  }
}
export class ProductAdminEnabledValidationError extends Error {
  constructor() {
    super('Product adminEnabled must be a boolean');
    this.name = 'ProductAdminEnabledValidationError';
  }
}
export class ProductDescriptionValidationError extends Error {
  constructor() {
    super('Product description must be empty or contain at most 500 characters after trimming');
    this.name = 'ProductDescriptionValidationError';
  }
}
export class ProductWeightValidationError extends Error {
  constructor() {
    super('Product weight must be a positive integer number of grams or empty');
    this.name = 'ProductWeightValidationError';
  }
}
export class ProductBadgeValidationError extends Error {
  constructor(field: 'isNew' | 'isHit') {
    super(`Product ${field} must be a boolean`);
    this.name = 'ProductBadgeValidationError';
  }
}
export function normalizeProductName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > PRODUCT_NAME_MAX_LENGTH) {
    throw new ProductNameValidationError();
  }
  return normalized;
}
export function normalizeProductBasePriceMinor(basePriceMinor: number): number {
  if (
    !Number.isSafeInteger(basePriceMinor) ||
    basePriceMinor <= 0 ||
    basePriceMinor > PRODUCT_BASE_PRICE_MINOR_MAX
  ) {
    throw new ProductBasePriceValidationError();
  }
  return basePriceMinor;
}
export function normalizeProductDescription(description: string | null): string | null {
  if (description === null) return null;
  const normalized = description.trim();
  if (normalized.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
    throw new ProductDescriptionValidationError();
  }
  return normalized.length === 0 ? null : normalized;
}
export function normalizeProductWeightGrams(weightGrams: number | null): number | null {
  if (weightGrams === null) return null;
  if (
    !Number.isSafeInteger(weightGrams) ||
    weightGrams <= 0 ||
    weightGrams > PRODUCT_WEIGHT_GRAMS_MAX
  ) {
    throw new ProductWeightValidationError();
  }
  return weightGrams;
}
function normalizeProductBadge(value: boolean, field: 'isNew' | 'isHit'): boolean {
  if (typeof value !== 'boolean') throw new ProductBadgeValidationError(field);
  return value;
}
export function normalizeProductId(value: string, field: 'id' | 'categoryId'): string {
  if (!UUID_PATTERN.test(value)) throw new ProductIdValidationError(field);
  return value;
}
export function normalizeProductCategoryId(categoryId: string): string {
  return normalizeProductId(categoryId, 'categoryId');
}
export function createProduct(input: {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceMinor: number;
  readonly adminEnabled: boolean;
  readonly description?: string | null;
  readonly weightGrams?: number | null;
  readonly isNew?: boolean;
  readonly isHit?: boolean;
}): Product {
  if (typeof input.adminEnabled !== 'boolean') {
    throw new ProductAdminEnabledValidationError();
  }
  return {
    id: normalizeProductId(input.id, 'id'),
    categoryId: normalizeProductCategoryId(input.categoryId),
    name: normalizeProductName(input.name),
    basePriceMinor: normalizeProductBasePriceMinor(input.basePriceMinor),
    adminEnabled: input.adminEnabled,
    description: normalizeProductDescription(input.description ?? null),
    weightGrams: normalizeProductWeightGrams(input.weightGrams ?? null),
    isNew: normalizeProductBadge(input.isNew ?? false, 'isNew'),
    isHit: normalizeProductBadge(input.isHit ?? false, 'isHit'),
  };
}

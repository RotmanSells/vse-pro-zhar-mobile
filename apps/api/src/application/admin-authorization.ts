export interface AdminPrincipal {
  readonly kind: string;
  readonly subject: string;
  readonly role: string;
}

export interface AdminIdentityResolver {
  resolve(input: { readonly rawHeader: unknown }): AdminPrincipal | undefined;
}

export const CATEGORY_CREATE_OPERATION = 'category:create' as const;
export const PRODUCT_CREATE_OPERATION = 'product:create' as const;
export const PRODUCT_UPDATE_OPERATION = 'product:update' as const;
export const PRODUCT_VISIBILITY_UPDATE_OPERATION = 'product:visibility:update' as const;
export const PRODUCT_IMAGE_CREATE_OPERATION = 'product:image:create' as const;
export const PRODUCT_IMAGE_UPDATE_OPERATION = 'product:image:update' as const;
export type AdminOperation =
  | typeof CATEGORY_CREATE_OPERATION
  | typeof PRODUCT_CREATE_OPERATION
  | typeof PRODUCT_UPDATE_OPERATION
  | typeof PRODUCT_VISIBILITY_UPDATE_OPERATION
  | typeof PRODUCT_IMAGE_CREATE_OPERATION
  | typeof PRODUCT_IMAGE_UPDATE_OPERATION;

export class CategoryAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Category create permission');
    this.name = 'CategoryAuthorizationError';
  }
}

export class ProductAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Product create permission');
    this.name = 'ProductAuthorizationError';
  }
}
export class ProductUpdateAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Product update permission');
    this.name = 'ProductUpdateAuthorizationError';
  }
}
export class ProductVisibilityUpdateAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Product visibility update permission');
    this.name = 'ProductVisibilityUpdateAuthorizationError';
  }
}
export class ProductImageCreateAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Product image create permission');
    this.name = 'ProductImageCreateAuthorizationError';
  }
}
export class ProductImageUpdateAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Product image update permission');
    this.name = 'ProductImageUpdateAuthorizationError';
  }
}

export function canPerformAdminOperation(
  principal: AdminPrincipal,
  operation: AdminOperation,
): boolean {
  return (
    (operation === CATEGORY_CREATE_OPERATION ||
      operation === PRODUCT_CREATE_OPERATION ||
      operation === PRODUCT_UPDATE_OPERATION ||
      operation === PRODUCT_VISIBILITY_UPDATE_OPERATION ||
      operation === PRODUCT_IMAGE_CREATE_OPERATION ||
      operation === PRODUCT_IMAGE_UPDATE_OPERATION) &&
    principal.kind === 'development_admin' &&
    principal.subject === 'development-admin' &&
    principal.role === 'admin'
  );
}

export function assertCanCreateProductImage(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, PRODUCT_IMAGE_CREATE_OPERATION)) {
    throw new ProductImageCreateAuthorizationError();
  }
}

export function assertCanUpdateProductImage(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, PRODUCT_IMAGE_UPDATE_OPERATION)) {
    throw new ProductImageUpdateAuthorizationError();
  }
}

export function assertCanCreateCategory(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, CATEGORY_CREATE_OPERATION)) {
    throw new CategoryAuthorizationError();
  }
}

export function assertCanCreateProduct(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, PRODUCT_CREATE_OPERATION)) {
    throw new ProductAuthorizationError();
  }
}

export function assertCanUpdateProduct(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, PRODUCT_UPDATE_OPERATION)) {
    throw new ProductUpdateAuthorizationError();
  }
}

export function assertCanUpdateProductVisibility(principal: AdminPrincipal): void {
  if (!canPerformAdminOperation(principal, PRODUCT_VISIBILITY_UPDATE_OPERATION)) {
    throw new ProductVisibilityUpdateAuthorizationError();
  }
}

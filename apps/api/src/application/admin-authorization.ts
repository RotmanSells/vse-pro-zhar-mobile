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
export type AdminOperation =
  | typeof CATEGORY_CREATE_OPERATION
  | typeof PRODUCT_CREATE_OPERATION
  | typeof PRODUCT_UPDATE_OPERATION;

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

export function canPerformAdminOperation(
  principal: AdminPrincipal,
  operation: AdminOperation,
): boolean {
  return (
    (operation === CATEGORY_CREATE_OPERATION ||
      operation === PRODUCT_CREATE_OPERATION ||
      operation === PRODUCT_UPDATE_OPERATION) &&
    principal.kind === 'development_admin' &&
    principal.subject === 'development-admin' &&
    principal.role === 'admin'
  );
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

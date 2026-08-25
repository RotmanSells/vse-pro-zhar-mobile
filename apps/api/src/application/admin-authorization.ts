export interface AdminPrincipal {
  readonly kind: string;
  readonly subject: string;
  readonly role: string;
}

export const CATEGORY_CREATE_OPERATION = 'category:create' as const;

export class CategoryAuthorizationError extends Error {
  constructor() {
    super('Admin principal lacks the Category create permission');
    this.name = 'CategoryAuthorizationError';
  }
}

export function canPerformAdminOperation(
  principal: AdminPrincipal,
  operation: typeof CATEGORY_CREATE_OPERATION,
): boolean {
  return (
    operation === CATEGORY_CREATE_OPERATION &&
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

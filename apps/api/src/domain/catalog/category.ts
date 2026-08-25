const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const CATEGORY_NAME_MAX_LENGTH = 200;

export interface Category {
  readonly id: string;
  readonly name: string;
}

export class CategoryNameValidationError extends Error {
  constructor() {
    super('Category name must contain between 1 and 200 characters after trimming');
    this.name = 'CategoryNameValidationError';
  }
}

export class CategoryIdValidationError extends Error {
  constructor() {
    super('Category id must be a UUID');
    this.name = 'CategoryIdValidationError';
  }
}

export function normalizeCategoryName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new CategoryNameValidationError();
  }
  return normalized;
}

export function createCategory(input: { readonly id: string; readonly name: string }): Category {
  if (!UUID_PATTERN.test(input.id)) throw new CategoryIdValidationError();
  return { id: input.id, name: normalizeCategoryName(input.name) };
}

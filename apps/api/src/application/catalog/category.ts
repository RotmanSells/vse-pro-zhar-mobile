import type { AdminPrincipal } from '../admin-authorization.ts';
import {
  assertCanCreateCategory,
  CATEGORY_CREATE_OPERATION,
  CategoryAuthorizationError,
} from '../admin-authorization.ts';
import {
  createCategory as createDomainCategory,
  normalizeCategoryName,
  type Category,
} from '../../domain/catalog/category.ts';

export { CATEGORY_CREATE_OPERATION, CategoryAuthorizationError };
export type { AdminPrincipal } from '../admin-authorization.ts';

export interface CategoryRepository {
  create(input: { readonly name: string }): Promise<Category>;
  list(): Promise<readonly Category[]>;
}

export async function createCategory(
  principal: AdminPrincipal,
  input: { readonly name: string },
  repository: CategoryRepository,
): Promise<Category> {
  assertCanCreateCategory(principal);
  return repository.create({ name: normalizeCategoryName(input.name) });
}

export async function listCategories(repository: CategoryRepository): Promise<readonly Category[]> {
  return repository.list();
}

export function validateCreatedCategory(category: Category): Category {
  return createDomainCategory(category);
}

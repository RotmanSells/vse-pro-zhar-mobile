import type { CategoryListResponse } from '@vse-pro-zhar/contracts';

export type CategoryLoadFailureReason =
  'configuration' | 'http' | 'invalid_response' | 'network' | 'timeout';

export type CategoryLoadResult =
  | { readonly kind: 'loaded'; readonly categories: CategoryListResponse }
  | { readonly kind: 'failure'; readonly reason: CategoryLoadFailureReason };

export interface CategoryListPort {
  listCategories(): Promise<CategoryLoadResult>;
}

export async function loadCategories(port: CategoryListPort): Promise<CategoryLoadResult> {
  try {
    return await port.listCategories();
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

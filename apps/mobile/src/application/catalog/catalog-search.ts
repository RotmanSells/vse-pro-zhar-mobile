import type { CategoryResponse } from '@vse-pro-zhar/contracts';

import type { MobileProductResponse } from './product.ts';

const ALL_CATEGORIES = 'all';

export function normalizeCatalogSearchText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function searchCatalogProducts(
  products: readonly MobileProductResponse[],
  categories: readonly CategoryResponse[],
  query: string,
  selectedCategoryId = ALL_CATEGORIES,
): readonly MobileProductResponse[] {
  const normalizedQuery = normalizeCatalogSearchText(query);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return products.filter((product) => {
    if (selectedCategoryId !== ALL_CATEGORIES && product.categoryId !== selectedCategoryId) {
      return false;
    }
    if (normalizedQuery.length === 0) return true;

    const categoryName = categoryNames.get(product.categoryId);
    return [product.name, product.description, categoryName].some(
      (field) =>
        field !== undefined &&
        field !== null &&
        normalizeCatalogSearchText(field).includes(normalizedQuery),
    );
  });
}

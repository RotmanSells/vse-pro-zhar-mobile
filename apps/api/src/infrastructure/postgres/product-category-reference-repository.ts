import type { Pool } from 'pg';

import type { ProductCategoryReferenceRepository } from '../../application/catalog/product.ts';

export function createPostgresProductCategoryReferenceRepository(
  pool: Pool,
): ProductCategoryReferenceRepository {
  return {
    async exists(categoryId) {
      const result = await pool.query<{ readonly id: string }>(
        'SELECT id FROM categories WHERE id = $1',
        [categoryId],
      );
      return result.rowCount === 1;
    },
  };
}

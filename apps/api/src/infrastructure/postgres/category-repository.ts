import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import type { Pool } from 'pg';

import type { CategoryRepository } from '../../application/catalog/category.ts';
import { createCategory, type Category } from '../../domain/catalog/category.ts';

const CategoryDatabaseRowSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

interface CategoryDatabaseRow {
  readonly id: string;
  readonly name: string;
}

function toCategory(row: unknown): Category {
  const parsed = CategoryDatabaseRowSchema.parse(row);
  return createCategory(parsed);
}

export function createPostgresCategoryRepository(pool: Pool): CategoryRepository {
  return {
    async create(input) {
      const result = await pool.query<CategoryDatabaseRow>(
        `
        INSERT INTO categories (id, name)
        VALUES ($1, $2)
        RETURNING id, name
        `,
        [randomUUID(), input.name],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Category insert returned no row');
      return toCategory(row);
    },

    async list() {
      const result = await pool.query<CategoryDatabaseRow>('SELECT id, name FROM categories');
      return result.rows.map((row) => toCategory(row));
    },
  };
}

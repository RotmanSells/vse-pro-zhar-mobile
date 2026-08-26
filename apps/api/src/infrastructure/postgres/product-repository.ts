import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import type { Pool } from 'pg';

import type { ProductRepository } from '../../application/catalog/product.ts';
import { createProduct, type Product } from '../../domain/catalog/product.ts';

const ProductDatabaseRowSchema = z
  .object({
    id: z.uuid(),
    category_id: z.uuid(),
    name: z.string().trim().min(1).max(200),
    base_price_minor: z.number().int().positive().max(2_147_483_647),
    admin_enabled: z.boolean(),
  })
  .strict();

interface ProductDatabaseRow {
  readonly id: string;
  readonly category_id: string;
  readonly name: string;
  readonly base_price_minor: number;
  readonly admin_enabled: boolean;
}

function toProduct(row: unknown): Product {
  const parsed = ProductDatabaseRowSchema.parse(row);
  return createProduct({
    id: parsed.id,
    categoryId: parsed.category_id,
    name: parsed.name,
    basePriceMinor: parsed.base_price_minor,
    adminEnabled: parsed.admin_enabled,
  });
}

export function createPostgresProductRepository(pool: Pool): ProductRepository {
  return {
    async create(input) {
      const result = await pool.query<ProductDatabaseRow>(
        `
        INSERT INTO products (id, category_id, name, base_price_minor, admin_enabled)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, category_id, name, base_price_minor, admin_enabled
        `,
        [randomUUID(), input.categoryId, input.name, input.basePriceMinor, input.adminEnabled],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Product insert returned no row');
      return toProduct(row);
    },

    async listVisible() {
      const result = await pool.query<ProductDatabaseRow>(
        `
        SELECT id, category_id, name, base_price_minor, admin_enabled
        FROM products
        WHERE admin_enabled = TRUE
        `,
      );
      return result.rows.map((row) => toProduct(row));
    },
  };
}

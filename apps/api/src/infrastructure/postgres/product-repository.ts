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
    description: z.string().trim().max(500).nullable(),
    weight_grams: z.number().int().positive().max(2_147_483_647).nullable(),
    is_new: z.boolean(),
    is_hit: z.boolean(),
  })
  .strict();
const ProductDetailsDatabaseRowSchema = ProductDatabaseRowSchema.extend({
  category_name: z.string().trim().min(1).max(200),
}).strict();

interface ProductDatabaseRow {
  readonly id: string;
  readonly category_id: string;
  readonly name: string;
  readonly base_price_minor: number;
  readonly admin_enabled: boolean;
  readonly description: string | null;
  readonly weight_grams: number | null;
  readonly is_new: boolean;
  readonly is_hit: boolean;
}

function toProduct(row: unknown): Product {
  const parsed = ProductDatabaseRowSchema.parse(row);
  return createProduct({
    id: parsed.id,
    categoryId: parsed.category_id,
    name: parsed.name,
    basePriceMinor: parsed.base_price_minor,
    adminEnabled: parsed.admin_enabled,
    description: parsed.description,
    weightGrams: parsed.weight_grams,
    isNew: parsed.is_new,
    isHit: parsed.is_hit,
  });
}

export function createPostgresProductRepository(pool: Pool): ProductRepository {
  return {
    async create(input) {
      const result = await pool.query<ProductDatabaseRow>(
        `
        INSERT INTO products (id, category_id, name, base_price_minor, admin_enabled, description, weight_grams, is_new, is_hit)
        VALUES ($1, $2, $3, $4, $5, NULL, NULL, FALSE, FALSE)
        RETURNING id, category_id, name, base_price_minor, admin_enabled, description, weight_grams, is_new, is_hit
        `,
        [randomUUID(), input.categoryId, input.name, input.basePriceMinor, input.adminEnabled],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Product insert returned no row');
      return toProduct(row);
    },

    async updateDetails(input) {
      const result = await pool.query<ProductDatabaseRow>(
        `
        UPDATE products
        SET description = $2, weight_grams = $3, is_new = $4, is_hit = $5
        WHERE id = $1
        RETURNING id, category_id, name, base_price_minor, admin_enabled, description, weight_grams, is_new, is_hit
        `,
        [input.id, input.description, input.weightGrams, input.isNew, input.isHit],
      );
      const row = result.rows[0];
      return row === undefined ? undefined : toProduct(row);
    },

    async listVisible() {
      const result = await pool.query<ProductDatabaseRow>(
        `
        SELECT id, category_id, name, base_price_minor, admin_enabled, description, weight_grams, is_new, is_hit
        FROM products
        WHERE admin_enabled = TRUE
        `,
      );
      return result.rows.map((row) => toProduct(row));
    },

    async findVisibleById(id) {
      const result = await pool.query<ProductDatabaseRow & { readonly category_name: string }>(
        `
        SELECT p.id, p.category_id, p.name, p.base_price_minor, p.admin_enabled,
               p.description, p.weight_grams, p.is_new, p.is_hit, c.name AS category_name
        FROM products AS p
        INNER JOIN categories AS c ON c.id = p.category_id
        WHERE p.id = $1 AND p.admin_enabled = TRUE
        `,
        [id],
      );
      const row = result.rows[0];
      if (row === undefined) return undefined;
      const parsed = ProductDetailsDatabaseRowSchema.parse(row);
      const { category_name, ...productRow } = parsed;
      return { categoryName: category_name, product: toProduct(productRow) };
    },
  };
}

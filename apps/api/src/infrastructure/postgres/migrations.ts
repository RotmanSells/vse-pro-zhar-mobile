import { readFileSync } from 'node:fs';

import type { Pool } from 'pg';

import {
  buildProductImageObjectKey,
  ProductImageStorageError,
  type ObjectStorage,
  type ProductImageProcessor,
  type StoredObject,
} from '../../application/catalog/product-image.ts';
import { randomUUID } from 'node:crypto';

export const CUSTOMER_PROFILE_MIGRATION_ID = '001_create_customers';
export const LEGAL_ACCEPTANCE_MIGRATION_ID = '002_create_customer_legal_acceptances';
export const CATEGORY_MIGRATION_ID = '003_create_categories';
export const PRODUCT_MIGRATION_ID = '004_create_products';
export const PRODUCT_DETAILS_MIGRATION_ID = '005_add_product_details';
export const PRODUCT_IMAGE_MIGRATION_ID = '006_add_product_image';
export const PRODUCT_IMAGE_CONTRACT_MIGRATION_ID = '007_enforce_product_image';

const CUSTOMER_PROFILE_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/001_create_customers.sql', import.meta.url),
  'utf8',
);

const LEGAL_ACCEPTANCE_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/002_create_customer_legal_acceptances.sql', import.meta.url),
  'utf8',
);

const CATEGORY_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/003_create_categories.sql', import.meta.url),
  'utf8',
);

const PRODUCT_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/004_create_products.sql', import.meta.url),
  'utf8',
);
const PRODUCT_DETAILS_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/005_add_product_details.sql', import.meta.url),
  'utf8',
);
const PRODUCT_IMAGE_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/006_add_product_image.sql', import.meta.url),
  'utf8',
);
const PRODUCT_IMAGE_CONTRACT_MIGRATION_SQL = readFileSync(
  new URL('../../../migrations/007_enforce_product_image.sql', import.meta.url),
  'utf8',
);

export async function applyMigrations(
  pool: Pool,
  options: { readonly includeContract?: boolean; readonly includeImages?: boolean } = {},
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _vpzh_schema_migrations (
        migration_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('SELECT pg_advisory_xact_lock($1)', [17_017]);

    const migrations = [
      { id: CUSTOMER_PROFILE_MIGRATION_ID, sql: CUSTOMER_PROFILE_MIGRATION_SQL },
      { id: LEGAL_ACCEPTANCE_MIGRATION_ID, sql: LEGAL_ACCEPTANCE_MIGRATION_SQL },
      { id: CATEGORY_MIGRATION_ID, sql: CATEGORY_MIGRATION_SQL },
      { id: PRODUCT_MIGRATION_ID, sql: PRODUCT_MIGRATION_SQL },
      { id: PRODUCT_DETAILS_MIGRATION_ID, sql: PRODUCT_DETAILS_MIGRATION_SQL },
    ];
    if (options.includeImages === true) {
      migrations.push({ id: PRODUCT_IMAGE_MIGRATION_ID, sql: PRODUCT_IMAGE_MIGRATION_SQL });
      if (options.includeContract !== false) {
        migrations.push({
          id: PRODUCT_IMAGE_CONTRACT_MIGRATION_ID,
          sql: PRODUCT_IMAGE_CONTRACT_MIGRATION_SQL,
        });
      }
    }
    for (const migration of migrations) {
      const existing = await client.query<{ migration_id: string }>(
        'SELECT migration_id FROM _vpzh_schema_migrations WHERE migration_id = $1',
        [migration.id],
      );
      if (existing.rows.length === 0) {
        await client.query(migration.sql);
        await client.query('INSERT INTO _vpzh_schema_migrations (migration_id) VALUES ($1)', [
          migration.id,
        ]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class ProductImageBackfillSourceMissingError extends Error {
  constructor() {
    super('An approved source image is missing for an existing Product');
    this.name = 'ProductImageBackfillSourceMissingError';
  }
}

async function consumeStoredObject(object: StoredObject): Promise<void> {
  if (object instanceof Uint8Array) return;
  for await (const chunk of object) {
    if (!(chunk instanceof Uint8Array)) throw new ProductImageStorageError();
  }
}

export async function backfillProductImages(input: {
  readonly pool: Pool;
  readonly imageProcessor: ProductImageProcessor;
  readonly objectStorage: ObjectStorage;
  readonly sourceImage: (productId: string) => Promise<Uint8Array | undefined>;
  readonly imageRevisionGenerator?: () => string;
}): Promise<number> {
  const revisionGenerator = input.imageRevisionGenerator ?? randomUUID;
  const result = await input.pool.query<{ readonly id: string }>(
    'SELECT id FROM products WHERE image_revision IS NULL ORDER BY id',
  );
  const sourceImages = new Map<string, Uint8Array>();
  for (const row of result.rows) {
    const source = await input.sourceImage(row.id);
    if (source === undefined) throw new ProductImageBackfillSourceMissingError();
    sourceImages.set(row.id, source);
  }

  let count = 0;
  for (const row of result.rows) {
    const imageRevision = revisionGenerator();
    const key = buildProductImageObjectKey(row.id, imageRevision);
    const source = sourceImages.get(row.id);
    if (source === undefined) throw new ProductImageBackfillSourceMissingError();
    const processed = await input.imageProcessor.process(source);
    try {
      await input.objectStorage.put({
        body: processed.data,
        contentType: 'image/webp',
        key,
      });
      await consumeStoredObject(await input.objectStorage.get({ key }));
      const updated = await input.pool.query(
        `
        UPDATE products
        SET image_revision = $2
        WHERE id = $1 AND image_revision IS NULL
        RETURNING id
        `,
        [row.id, imageRevision],
      );
      if (updated.rowCount !== 1) throw new Error('Product image backfill CAS failed');
      count += 1;
    } catch (error) {
      try {
        await input.objectStorage.delete({ key });
      } catch {
        console.error('product_image_backfill_cleanup_failed');
      }
      if (error instanceof ProductImageStorageError) throw error;
      throw error;
    }
  }
  return count;
}

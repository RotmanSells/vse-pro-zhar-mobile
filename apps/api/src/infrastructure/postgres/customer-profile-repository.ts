import { randomUUID } from 'node:crypto';

import { z } from 'zod';
import type { Pool } from 'pg';

import type { CustomerProfileRepository } from '../../application/customer-profile.ts';
import type { CustomerProfile } from '../../domain/customer/customer-profile.ts';

const CustomerProfileDatabaseRowSchema = z
  .object({
    id: z.uuid(),
    phone: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(200).nullable(),
    birthday: z.iso.date().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
  })
  .strict();

interface CustomerProfileDatabaseRow {
  readonly id: string;
  readonly phone: string;
  readonly name: string | null;
  readonly birthday: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const PROFILE_COLUMNS = `
  id,
  phone,
  name,
  birthday::text AS birthday,
  created_at,
  updated_at
`;

function toCustomerProfile(row: unknown): CustomerProfile {
  const parsed = CustomerProfileDatabaseRowSchema.parse(row);

  return {
    customerId: parsed.id,
    phone: parsed.phone,
    name: parsed.name,
    birthday: parsed.birthday,
    createdAt: parsed.created_at.toISOString(),
    updatedAt: parsed.updated_at.toISOString(),
  };
}

function assertReturnedRow(
  row: CustomerProfileDatabaseRow | undefined,
): CustomerProfileDatabaseRow {
  if (row === undefined) throw new Error('Customer profile query returned no row');
  return row;
}

export function createPostgresCustomerProfileRepository(pool: Pool): CustomerProfileRepository {
  return {
    async findOrCreateByPhone(phone) {
      const result = await pool.query<CustomerProfileDatabaseRow>(
        `
        INSERT INTO customers (id, phone)
        VALUES ($1, $2)
        ON CONFLICT (phone) DO UPDATE SET phone = customers.phone
        RETURNING ${PROFILE_COLUMNS}
        `,
        [randomUUID(), phone],
      );

      return toCustomerProfile(assertReturnedRow(result.rows[0]));
    },

    async updateById(customerId, changes) {
      const hasName = changes.name !== undefined;
      const hasBirthday = changes.birthday !== undefined;
      const result = await pool.query<CustomerProfileDatabaseRow>(
        `
        UPDATE customers
        SET
          name = CASE WHEN $2::boolean THEN $3::text ELSE name END,
          birthday = CASE WHEN $4::boolean THEN $5::date ELSE birthday END,
          updated_at = CASE WHEN $2::boolean OR $4::boolean THEN CURRENT_TIMESTAMP ELSE updated_at END
        WHERE id = $1
        RETURNING ${PROFILE_COLUMNS}
        `,
        [customerId, hasName, changes.name ?? null, hasBirthday, changes.birthday ?? null],
      );

      return toCustomerProfile(assertReturnedRow(result.rows[0]));
    },
  };
}

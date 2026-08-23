import { z } from 'zod';
import type { Pool } from 'pg';

import type { LegalAcceptanceRepository } from '../../application/legal-acceptance.ts';
import {
  isLegalDocumentType,
  type LegalAcceptance,
} from '../../domain/customer/legal-acceptance.ts';

const LegalAcceptanceDatabaseRowSchema = z
  .object({
    accepted_at: z.date(),
    customer_id: z.uuid(),
    document_type: z.string(),
    document_version: z.string().trim().min(1).max(255),
  })
  .strict();

interface LegalAcceptanceDatabaseRow {
  readonly accepted_at: Date;
  readonly customer_id: string;
  readonly document_type: string;
  readonly document_version: string;
}

function toLegalAcceptance(row: unknown): LegalAcceptance {
  const parsed = LegalAcceptanceDatabaseRowSchema.parse(row);
  if (!isLegalDocumentType(parsed.document_type)) {
    throw new Error('Legal acceptance query returned an unsupported document type');
  }
  return {
    acceptedAt: parsed.accepted_at.toISOString(),
    customerId: parsed.customer_id,
    documentType: parsed.document_type,
    documentVersion: parsed.document_version,
  };
}

function assertReturnedRow(
  row: LegalAcceptanceDatabaseRow | undefined,
): LegalAcceptanceDatabaseRow {
  if (row === undefined) throw new Error('Legal acceptance query returned no row');
  return row;
}

export function createPostgresLegalAcceptanceRepository(pool: Pool): LegalAcceptanceRepository {
  return {
    async listByCustomerId(customerId) {
      const result = await pool.query<LegalAcceptanceDatabaseRow>(
        `
        SELECT customer_id, document_type, document_version, accepted_at
        FROM customer_legal_acceptances
        WHERE customer_id = $1
        ORDER BY document_type ASC
        `,
        [customerId],
      );
      return result.rows.map(toLegalAcceptance);
    },

    async recordAcceptance(customerId, document) {
      const inserted = await pool.query<LegalAcceptanceDatabaseRow>(
        `
        INSERT INTO customer_legal_acceptances (customer_id, document_type, document_version)
        VALUES ($1, $2, $3)
        ON CONFLICT (customer_id, document_type, document_version) DO NOTHING
        RETURNING customer_id, document_type, document_version, accepted_at
        `,
        [customerId, document.documentType, document.documentVersion],
      );
      if (inserted.rows[0] !== undefined) return toLegalAcceptance(inserted.rows[0]);

      const existing = await pool.query<LegalAcceptanceDatabaseRow>(
        `
        SELECT customer_id, document_type, document_version, accepted_at
        FROM customer_legal_acceptances
        WHERE customer_id = $1 AND document_type = $2 AND document_version = $3
        `,
        [customerId, document.documentType, document.documentVersion],
      );
      return toLegalAcceptance(assertReturnedRow(existing.rows[0]));
    },
  };
}

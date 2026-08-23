import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LegalAcceptanceResponseSchema,
  RecordLegalAcceptanceRequestSchema,
} from '../../src/legal-acceptance.ts';

await test('legal acceptance contract permits only the two required test-only documents', () => {
  const response = LegalAcceptanceResponseSchema.parse({
    mode: 'test_only',
    documents: [
      {
        acceptedAt: null,
        documentType: 'privacy_policy',
        documentVersion: 'test-privacy-policy-v1',
        status: 'required',
      },
      {
        acceptedAt: '2026-08-24T10:00:00.000Z',
        documentType: 'user_agreement',
        documentVersion: 'test-user-agreement-v1',
        status: 'accepted',
      },
    ],
  });

  assert.equal(response.mode, 'test_only');
  assert.equal(response.documents[1]?.acceptedAt, '2026-08-24T10:00:00.000Z');
  assert.equal(
    LegalAcceptanceResponseSchema.safeParse({
      ...response,
      documents: response.documents.map((document) =>
        document.documentType === 'privacy_policy'
          ? { ...document, documentVersion: '2026.1' }
          : document,
      ),
    }).success,
    false,
  );
});

await test('legal acceptance contract requires a single explicit supported document type', () => {
  assert.equal(
    RecordLegalAcceptanceRequestSchema.safeParse({ documentType: 'privacy_policy' }).success,
    true,
  );
  assert.equal(
    RecordLegalAcceptanceRequestSchema.safeParse({
      documentType: 'marketing_consent',
    }).success,
    false,
  );
  assert.equal(
    RecordLegalAcceptanceRequestSchema.safeParse({
      documentType: 'user_agreement',
      documentVersion: 'production-v1',
    }).success,
    false,
  );
});

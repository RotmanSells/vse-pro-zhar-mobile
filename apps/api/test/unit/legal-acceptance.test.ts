import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCurrentLegalAcceptances,
  recordCurrentLegalAcceptance,
  type LegalAcceptanceRepository,
} from '../../src/application/legal-acceptance.ts';
import type { CustomerProfileRepository } from '../../src/application/customer-profile.ts';
import type { LegalAcceptance } from '../../src/domain/customer/legal-acceptance.ts';

const identity = { kind: 'development_identity' as const, phone: '+7 900 000-00-00' };
const customerId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';

function customerRepository(): CustomerProfileRepository {
  return {
    findOrCreateByPhone: () =>
      Promise.resolve({
        birthday: null,
        createdAt: '2026-08-24T10:00:00.000Z',
        customerId,
        name: null,
        phone: identity.phone,
        updatedAt: '2026-08-24T10:00:00.000Z',
      }),
    updateById: () => Promise.reject(new Error('Profile update is not part of legal acceptance')),
  };
}

await test('current legal acceptance exposes the two required test-only documents', async () => {
  const repository: LegalAcceptanceRepository = {
    listByCustomerId: () => Promise.resolve([]),
    recordAcceptance: () => Promise.reject(new Error('Record should not be called while loading')),
  };

  const result = await getCurrentLegalAcceptances(identity, customerRepository(), repository);

  assert.deepEqual(result, {
    documents: [
      {
        acceptedAt: null,
        documentType: 'privacy_policy',
        documentVersion: 'test-privacy-policy-v1',
        status: 'required',
      },
      {
        acceptedAt: null,
        documentType: 'user_agreement',
        documentVersion: 'test-user-agreement-v1',
        status: 'required',
      },
    ],
    mode: 'test_only',
  });
});

await test('recording one explicit acceptance returns state reloaded from the repository', async () => {
  const acceptances: LegalAcceptance[] = [];
  const repository: LegalAcceptanceRepository = {
    listByCustomerId: () => Promise.resolve(acceptances),
    recordAcceptance: (_id, document) => {
      const acceptance: LegalAcceptance = {
        acceptedAt: '2026-08-24T10:00:00.000Z',
        customerId,
        documentType: document.documentType,
        documentVersion: document.documentVersion,
      };
      acceptances.push(acceptance);
      return Promise.resolve(acceptance);
    },
  };

  const result = await recordCurrentLegalAcceptance(
    identity,
    'privacy_policy',
    customerRepository(),
    repository,
  );

  assert.equal(result.documents[0]?.status, 'accepted');
  assert.equal(result.documents[0]?.acceptedAt, '2026-08-24T10:00:00.000Z');
  assert.equal(result.documents[1]?.status, 'required');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CustomerProfilePatchRequestSchema,
  CustomerProfileResponseSchema,
} from '../../src/customer-profile.ts';

await test('customer profile contract accepts the initial nullable profile shape', () => {
  const profile = CustomerProfileResponseSchema.parse({
    birthday: null,
    createdAt: '2026-08-23T10:00:00.000Z',
    customerId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    name: null,
    phone: '+7 900 000-00-00',
    updatedAt: '2026-08-23T10:00:00.000Z',
  });

  assert.equal(profile.name, null);
  assert.equal(profile.birthday, null);
});

await test('customer profile patch contract rejects unknown and empty payloads', () => {
  assert.equal(CustomerProfilePatchRequestSchema.safeParse({}).success, false);
  assert.equal(
    CustomerProfilePatchRequestSchema.safeParse({ email: 'not-allowed' }).success,
    false,
  );
  assert.equal(
    CustomerProfilePatchRequestSchema.safeParse({ birthday: '03-02-1990' }).success,
    false,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCurrentCustomerProfile,
  updateCurrentCustomerProfile,
  type CustomerProfileRepository,
} from '../../src/application/customer-profile.ts';
import type {
  CustomerProfile,
  CustomerProfileUpdate,
} from '../../src/domain/customer/customer-profile.ts';

function createRepository(): CustomerProfileRepository {
  const profile: CustomerProfile = {
    customerId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    phone: '+7 900 000-00-00',
    name: null,
    birthday: null,
    createdAt: '2026-08-23T10:00:00.000Z',
    updatedAt: '2026-08-23T10:00:00.000Z',
  };

  return {
    findOrCreateByPhone(): Promise<CustomerProfile> {
      return Promise.resolve(profile);
    },
    updateById(_customerId: string, changes: CustomerProfileUpdate): Promise<CustomerProfile> {
      return Promise.resolve({
        ...profile,
        name: changes.name === undefined ? profile.name : changes.name,
        birthday: changes.birthday === undefined ? profile.birthday : changes.birthday,
        updatedAt: '2026-08-23T10:01:00.000Z',
      });
    },
  };
}

await test('the current profile use case allows a new customer without a name', async () => {
  const profile = await getCurrentCustomerProfile(
    { kind: 'development_identity', phone: '+7 900 000-00-00' },
    createRepository(),
  );

  assert.equal(profile.name, null);
  assert.equal(profile.birthday, null);
});

await test('the update use case changes only profile fields', async () => {
  const profile = await updateCurrentCustomerProfile(
    { kind: 'development_identity', phone: '+7 900 000-00-00' },
    { name: 'Иван', birthday: '1990-02-03' },
    createRepository(),
  );

  assert.deepEqual(
    {
      customerId: profile.customerId,
      phone: profile.phone,
      name: profile.name,
      birthday: profile.birthday,
    },
    {
      customerId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      phone: '+7 900 000-00-00',
      name: 'Иван',
      birthday: '1990-02-03',
    },
  );
});

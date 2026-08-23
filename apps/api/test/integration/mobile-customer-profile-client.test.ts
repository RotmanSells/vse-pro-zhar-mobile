import assert from 'node:assert/strict';
import test from 'node:test';

import { CustomerProfileResponseSchema } from '@vse-pro-zhar/contracts';

import { createDevelopmentIdentity } from '../../../mobile/src/application/development-identity.ts';
import { createCustomerProfileApiClient } from '../../../mobile/src/infrastructure/customer-profile-api-client.ts';
import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentIdentityResolver } from '../../src/infrastructure/development-identity-boundary.ts';
import { createPostgresCustomerProfileRepository } from '../../src/infrastructure/postgres/customer-profile-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

await test('mobile profile client reaches the real VPZH-017 HTTP and PostgreSQL path', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);

  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(database.pool),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' }),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const identity = createDevelopmentIdentity('  +7 918 018-00-00  ');
    assert.notEqual(identity, undefined);
    const mobileClient = createCustomerProfileApiClient({
      apiBaseUrl: `http://127.0.0.1:${port}`,
    });

    const result = await mobileClient.getCurrentProfile(identity!);

    assert.equal(result.kind, 'profile');
    if (result.kind !== 'profile') return;
    const profile = CustomerProfileResponseSchema.parse(result.profile);
    assert.equal(profile.phone, '+7 918 018-00-00');
    assert.equal(profile.name, null);
    assert.equal(profile.birthday, null);

    const stored = await database.pool.query<{
      id: string;
      phone: string;
      name: string | null;
      birthday: string | null;
    }>('SELECT id, phone, name, birthday::text AS birthday FROM customers WHERE id = $1', [
      profile.customerId,
    ]);
    assert.deepEqual(stored.rows, [
      {
        id: profile.customerId,
        phone: '+7 918 018-00-00',
        name: null,
        birthday: null,
      },
    ]);
  } finally {
    await closeServer(server);
    await database.cleanup();
  }
});

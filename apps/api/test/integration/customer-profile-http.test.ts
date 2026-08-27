import assert from 'node:assert/strict';
import test from 'node:test';

import { CustomerProfileResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentIdentityResolver } from '../../src/infrastructure/development-identity-boundary.ts';
import { createPostgresCustomerProfileRepository } from '../../src/infrastructure/postgres/customer-profile-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

const identityHeader = 'x-vpzh-development-identity';
const identityPhone = '+7 900 000-00-00';

await test('real HTTP profile flow persists and reloads a customer through PostgreSQL', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  await applyMigrations(database.pool);
  const migrations = await database.pool.query<{ migration_id: string }>(
    'SELECT migration_id FROM _vpzh_schema_migrations',
  );
  assert.deepEqual(migrations.rows, [
    { migration_id: '001_create_customers' },
    { migration_id: '002_create_customer_legal_acceptances' },
    { migration_id: '003_create_categories' },
    { migration_id: '004_create_products' },
    { migration_id: '005_add_product_details' },
  ]);

  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(database.pool),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' }),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const firstResponse = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      headers: { [identityHeader]: identityPhone },
    });
    assert.equal(firstResponse.status, 200);
    const firstProfile = CustomerProfileResponseSchema.parse(await firstResponse.json());
    assert.equal(firstProfile.phone, identityPhone);
    assert.equal(firstProfile.name, null);
    assert.equal(firstProfile.birthday, null);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      body: JSON.stringify({ birthday: '1990-02-03', name: 'Иван' }),
      headers: {
        'content-type': 'application/json',
        [identityHeader]: identityPhone,
      },
      method: 'PATCH',
    });
    assert.equal(updateResponse.status, 200);
    const updatedProfile = CustomerProfileResponseSchema.parse(await updateResponse.json());
    assert.equal(updatedProfile.customerId, firstProfile.customerId);
    assert.equal(updatedProfile.name, 'Иван');
    assert.equal(updatedProfile.birthday, '1990-02-03');

    const secondResponse = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      headers: { [identityHeader]: identityPhone },
    });
    const secondProfile = CustomerProfileResponseSchema.parse(await secondResponse.json());
    assert.equal(secondProfile.customerId, firstProfile.customerId);
    assert.equal(secondProfile.name, 'Иван');
    assert.equal(secondProfile.birthday, '1990-02-03');

    const stored = await database.pool.query<{ phone: string; name: string; birthday: string }>(
      'SELECT phone, name, birthday::text AS birthday FROM customers WHERE id = $1',
      [firstProfile.customerId],
    );
    assert.deepEqual(stored.rows[0], {
      phone: identityPhone,
      name: 'Иван',
      birthday: '1990-02-03',
    });
  } finally {
    await closeServer(server);
    await database.cleanup();
  }
});

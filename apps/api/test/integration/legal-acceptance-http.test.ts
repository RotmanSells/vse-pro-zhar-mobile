import assert from 'node:assert/strict';
import test from 'node:test';

import { LegalAcceptanceResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentIdentityResolver } from '../../src/infrastructure/development-identity-boundary.ts';
import { createPostgresCustomerProfileRepository } from '../../src/infrastructure/postgres/customer-profile-repository.ts';
import { createPostgresLegalAcceptanceRepository } from '../../src/infrastructure/postgres/legal-acceptance-repository.ts';
import { applyMigrations } from '../../src/infrastructure/postgres/migrations.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';
import { createIsolatedPostgresTestContext } from '../helpers/postgres.ts';

const identityHeader = 'x-vpzh-development-identity';
const identityPhone = '+7 900 021-00-00';

await test('real HTTP legal acceptance persists both test-only records and reloads them from PostgreSQL', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  await applyMigrations(database.pool);
  const migrations = await database.pool.query<{ migration_id: string }>(
    'SELECT migration_id FROM _vpzh_schema_migrations ORDER BY migration_id',
  );
  assert.deepEqual(migrations.rows, [
    { migration_id: '001_create_customers' },
    { migration_id: '002_create_customer_legal_acceptances' },
    { migration_id: '003_create_categories' },
    { migration_id: '004_create_products' },
  ]);

  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(database.pool),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' }),
    legalAcceptanceRepository: createPostgresLegalAcceptanceRepository(database.pool),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const initialResponse = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      headers: { [identityHeader]: identityPhone },
    });
    assert.equal(initialResponse.status, 200);
    const initial = LegalAcceptanceResponseSchema.parse(await initialResponse.json());
    assert.deepEqual(
      initial.documents.map((document) => [document.documentType, document.status]),
      [
        ['privacy_policy', 'required'],
        ['user_agreement', 'required'],
      ],
    );

    for (const documentType of ['privacy_policy', 'user_agreement'] as const) {
      const response = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
        body: JSON.stringify({ documentType }),
        headers: {
          'content-type': 'application/json',
          [identityHeader]: identityPhone,
        },
        method: 'POST',
      });
      assert.equal(response.status, 200);
    }

    const reloadedResponse = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      headers: { [identityHeader]: identityPhone },
    });
    const reloaded = LegalAcceptanceResponseSchema.parse(await reloadedResponse.json());
    assert.deepEqual(
      reloaded.documents.map((document) => document.status),
      ['accepted', 'accepted'],
    );
    for (const document of reloaded.documents) assert.notEqual(document.acceptedAt, null);

    const stored = await database.pool.query<{
      accepted_at: Date;
      document_type: string;
      document_version: string;
    }>(
      `
      SELECT acceptance.document_type, acceptance.document_version, acceptance.accepted_at
      FROM customer_legal_acceptances AS acceptance
      INNER JOIN customers ON customers.id = acceptance.customer_id
      WHERE customers.phone = $1
      ORDER BY acceptance.document_type
      `,
      [identityPhone],
    );
    assert.deepEqual(
      stored.rows.map((row) => [
        row.document_type,
        row.document_version,
        row.accepted_at instanceof Date,
      ]),
      [
        ['privacy_policy', 'test-privacy-policy-v1', true],
        ['user_agreement', 'test-user-agreement-v1', true],
      ],
    );
  } finally {
    await closeServer(server);
    await database.cleanup();
  }
});

await test('a previous document version remains history while the current test version is accepted', async () => {
  const database = await createIsolatedPostgresTestContext();
  await applyMigrations(database.pool);
  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(database.pool),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' }),
    legalAcceptanceRepository: createPostgresLegalAcceptanceRepository(database.pool),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const initialResponse = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      headers: { [identityHeader]: identityPhone },
    });
    const initial = LegalAcceptanceResponseSchema.parse(await initialResponse.json());
    assert.equal(initial.documents[0]?.status, 'required');

    const customer = await database.pool.query<{ id: string }>(
      'SELECT id FROM customers WHERE phone = $1',
      [identityPhone],
    );
    const customerId = customer.rows[0]?.id;
    assert.notEqual(customerId, undefined);
    await database.pool.query(
      `
      INSERT INTO customer_legal_acceptances (customer_id, document_type, document_version)
      VALUES ($1, $2, $3)
      `,
      [customerId, 'privacy_policy', 'test-privacy-policy-v0'],
    );

    const requiredResponse = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      headers: { [identityHeader]: identityPhone },
    });
    const required = LegalAcceptanceResponseSchema.parse(await requiredResponse.json());
    assert.equal(required.documents[0]?.status, 'required');

    const acceptedResponse = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      body: JSON.stringify({ documentType: 'privacy_policy' }),
      headers: { 'content-type': 'application/json', [identityHeader]: identityPhone },
      method: 'POST',
    });
    const accepted = LegalAcceptanceResponseSchema.parse(await acceptedResponse.json());
    assert.equal(accepted.documents[0]?.status, 'accepted');

    const history = await database.pool.query<{ document_version: string }>(
      `
      SELECT document_version
      FROM customer_legal_acceptances
      WHERE customer_id = $1 AND document_type = 'privacy_policy'
      ORDER BY document_version
      `,
      [customerId],
    );
    assert.deepEqual(history.rows, [
      { document_version: 'test-privacy-policy-v0' },
      { document_version: 'test-privacy-policy-v1' },
    ]);
  } finally {
    await closeServer(server);
    await database.cleanup();
  }
});

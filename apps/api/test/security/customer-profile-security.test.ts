import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiErrorResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentIdentityResolver } from '../../src/infrastructure/development-identity-boundary.ts';
import type { CustomerProfileRepository } from '../../src/application/customer-profile.ts';
import type { LegalAcceptanceRepository } from '../../src/application/legal-acceptance.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

const identityHeader = 'x-vpzh-development-identity';

function repositoryMustNotBeCalled(): CustomerProfileRepository {
  return {
    findOrCreateByPhone: () => Promise.reject(new Error('repository must not be called')),
    updateById: () => Promise.reject(new Error('repository must not be called')),
  };
}

function legalAcceptanceRepositoryMustNotBeCalled(): LegalAcceptanceRepository {
  return {
    listByCustomerId: () => Promise.reject(new Error('legal repository must not be called')),
    recordAcceptance: () => Promise.reject(new Error('legal repository must not be called')),
  };
}

await test('production runtime rejects the development identity header with 401', async () => {
  const server = createApiServer({
    customerProfileRepository: repositoryMustNotBeCalled(),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'production' }),
    legalAcceptanceRepository: legalAcceptanceRepositoryMustNotBeCalled(),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      headers: { [identityHeader]: '+7 900 000-00-00' },
    });
    const responseText = await response.text();
    const body = ApiErrorResponseSchema.parse(JSON.parse(responseText) as unknown);

    assert.equal(response.status, 401);
    assert.deepEqual(body.error, {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
    });
    assert.equal(responseText.includes('repository must not be called'), false);
    assert.equal(responseText.includes('token'), false);
  } finally {
    await closeServer(server);
  }
});

await test('production runtime rejects test-only legal acceptance before persistence', async () => {
  const server = createApiServer({
    customerProfileRepository: repositoryMustNotBeCalled(),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'production' }),
    legalAcceptanceRepository: legalAcceptanceRepositoryMustNotBeCalled(),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/me/legal-acceptances`, {
      headers: { [identityHeader]: '+7 900 000-00-00' },
    });
    const responseText = await response.text();
    const body = ApiErrorResponseSchema.parse(JSON.parse(responseText) as unknown);

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(responseText.includes('legal repository must not be called'), false);
  } finally {
    await closeServer(server);
  }
});

await test('invalid profile input returns a safe 400 without calling persistence', async () => {
  const server = createApiServer({
    customerProfileRepository: repositoryMustNotBeCalled(),
    identityResolver: createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' }),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      body: JSON.stringify({ email: 'must-not-be-accepted' }),
      headers: {
        'content-type': 'application/json',
        [identityHeader]: '+7 900 000-00-00',
      },
      method: 'PATCH',
    });
    const responseText = await response.text();
    const body = ApiErrorResponseSchema.parse(JSON.parse(responseText) as unknown);

    assert.equal(response.status, 400);
    assert.deepEqual(body.error, {
      code: 'INVALID_REQUEST',
      message: 'Invalid request',
    });
    assert.equal(responseText.includes('must-not-be-accepted'), false);
    assert.equal(responseText.includes('stack'), false);
  } finally {
    await closeServer(server);
  }
});

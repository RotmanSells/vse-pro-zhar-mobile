import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';

import { ApiErrorResponseSchema } from '@vse-pro-zhar/contracts';

import type { CategoryRepository } from '../../src/application/catalog/category.ts';
import { createApiServer } from '../../src/composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import type { CustomerProfileRepository } from '../../src/application/customer-profile.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

function categoryRepositoryMustNotBeCalled(): CategoryRepository {
  return {
    create: () => Promise.reject(new Error('category repository must not be called')),
    list: () => Promise.reject(new Error('category repository must not be called')),
  };
}

function customerRepositoryMustNotBeCalled(): CustomerProfileRepository {
  return {
    findOrCreateByPhone: () => Promise.reject(new Error('customer repository must not be called')),
    updateById: () => Promise.reject(new Error('customer repository must not be called')),
  };
}

async function readError(
  response: Response,
): Promise<ReturnType<typeof ApiErrorResponseSchema.parse>> {
  const responseText = await response.text();
  const body = ApiErrorResponseSchema.parse(JSON.parse(responseText) as unknown);
  assert.equal(responseText.includes('admin'), false);
  assert.equal(responseText.includes('stack'), false);
  return body;
}

async function requestWithDuplicateAdminHeader(
  port: number,
): Promise<{ readonly status: number; readonly body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: '127.0.0.1',
        method: 'POST',
        path: '/admin/categories',
        port,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength('{"name":"Супы"}'),
          'x-vpzh-development-admin-identity': ['admin', 'admin'],
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end('{"name":"Супы"}');
  });
}

await test('Admin mutation rejects missing, malformed and duplicate identity before persistence', async () => {
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    categoryRepository: categoryRepositoryMustNotBeCalled(),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    for (const header of [undefined, '', 'administrator']) {
      const response = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
        body: JSON.stringify({ name: 'Супы' }),
        headers: {
          'content-type': 'application/json',
          ...(header === undefined ? {} : { 'x-vpzh-development-admin-identity': header }),
        },
        method: 'POST',
      });
      assert.equal(response.status, 401);
      assert.deepEqual((await readError(response)).error, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const duplicate = await requestWithDuplicateAdminHeader(port);
    assert.equal(duplicate.status, 401);
    assert.deepEqual(ApiErrorResponseSchema.parse(JSON.parse(duplicate.body) as unknown).error, {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
    });
  } finally {
    await closeServer(server);
  }
});

await test('disabled and production Admin boundaries fail closed', async () => {
  for (const runtime of ['test', 'production'] as const) {
    const server = createApiServer({
      adminIdentityResolver: createDevelopmentAdminIdentityResolver({
        enabled: runtime === 'production',
        runtime,
      }),
      categoryRepository: categoryRepositoryMustNotBeCalled(),
    });
    const port = await listenOnEphemeralPort(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
        body: JSON.stringify({ name: 'Супы' }),
        headers: {
          'content-type': 'application/json',
          'x-vpzh-development-admin-identity': 'admin',
        },
        method: 'POST',
      });
      assert.equal(response.status, 401);
      assert.equal((await readError(response)).error.code, 'AUTHENTICATION_REQUIRED');
    } finally {
      await closeServer(server);
    }
  }
});

await test('customer identity cannot authorize Category and Admin identity cannot authorize /me', async () => {
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    categoryRepository: categoryRepositoryMustNotBeCalled(),
    customerProfileRepository: customerRepositoryMustNotBeCalled(),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const customerHeaderResponse = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
      body: JSON.stringify({ name: 'Супы' }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-identity': '+7 900 000-00-00',
      },
      method: 'POST',
    });
    assert.equal(customerHeaderResponse.status, 401);
    assert.equal((await readError(customerHeaderResponse)).error.code, 'AUTHENTICATION_REQUIRED');

    const adminOnCustomerResponse = await fetch(`http://127.0.0.1:${port}/me/profile`, {
      headers: { 'x-vpzh-development-admin-identity': 'admin' },
    });
    assert.equal(adminOnCustomerResponse.status, 401);
    assert.equal((await readError(adminOnCustomerResponse)).error.code, 'AUTHENTICATION_REQUIRED');
  } finally {
    await closeServer(server);
  }
});

await test('authenticated Admin without the Category-create permission receives safe 403', async () => {
  const server = createApiServer({
    adminIdentityResolver: {
      resolve: () => ({
        kind: 'development_admin',
        subject: 'development-admin',
        role: 'viewer',
      }),
    },
    categoryRepository: categoryRepositoryMustNotBeCalled(),
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin/categories`, {
      body: JSON.stringify({ name: 'Супы' }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    assert.equal(response.status, 403);
    assert.deepEqual((await readError(response)).error, {
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  } finally {
    await closeServer(server);
  }
});

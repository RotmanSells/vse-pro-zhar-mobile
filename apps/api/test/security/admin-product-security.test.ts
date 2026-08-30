import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiErrorResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import type { ProductRepository } from '../../src/application/catalog/product.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const details = {
  description: 'Состав',
  isHit: true,
  isNew: false,
  weightGrams: 350,
};

function rejectedRepository(): ProductRepository {
  const rejected = (): Promise<never> =>
    Promise.reject(new Error('product persistence must not be called'));
  return {
    create: rejected,
    findVisibleById: rejected,
    listAll: rejected,
    listVisible: rejected,
    updateDetails: rejected,
    updateVisibility: rejected,
  };
}

async function safeError(response: Response): Promise<void> {
  const body = await response.text();
  assert.equal(body.includes('product persistence'), false);
  const parsed = ApiErrorResponseSchema.parse(JSON.parse(body) as unknown);
  assert.deepEqual(parsed.error, {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
  });
}

async function patch(port: number, headers: Record<string, string>): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/admin/products/${productId}/details`, {
    body: JSON.stringify(details),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'PATCH',
  });
}

await test('Product details update rejects customer identity, disabled and production Admin boundaries', async () => {
  const configurations = [
    createDevelopmentAdminIdentityResolver({ enabled: true, runtime: 'test' }),
    createDevelopmentAdminIdentityResolver({ enabled: false, runtime: 'test' }),
    createDevelopmentAdminIdentityResolver({ enabled: true, runtime: 'production' }),
  ];
  for (const [index, resolver] of configurations.entries()) {
    const server = createApiServer({
      adminIdentityResolver: resolver,
      productRepository: rejectedRepository(),
    });
    const port = await listenOnEphemeralPort(server);
    try {
      const headers =
        index === 0
          ? { 'x-vpzh-development-identity': '+7 900 000-00-00' }
          : { 'x-vpzh-development-admin-identity': 'admin' };
      const response = await patch(port, headers);
      assert.equal(response.status, 401);
      await safeError(response);
    } finally {
      await closeServer(server);
    }
  }
});

await test('Product details update requires the named Product-update permission', async () => {
  const server = createApiServer({
    adminIdentityResolver: {
      resolve: () => ({
        kind: 'development_admin',
        role: 'viewer',
        subject: 'development-admin',
      }),
    },
    productRepository: rejectedRepository(),
  });
  const port = await listenOnEphemeralPort(server);
  try {
    const response = await patch(port, { 'x-vpzh-development-admin-identity': 'admin' });
    assert.equal(response.status, 403);
    const parsed = ApiErrorResponseSchema.parse((await response.json()) as unknown);
    assert.deepEqual(parsed.error, { code: 'FORBIDDEN', message: 'Forbidden' });
  } finally {
    await closeServer(server);
  }
});

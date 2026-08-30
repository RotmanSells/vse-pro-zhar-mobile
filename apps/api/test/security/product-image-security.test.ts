import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiErrorResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import type { ProductRepository } from '../../src/application/catalog/product.ts';
import { createDevelopmentAdminIdentityResolver } from '../../src/infrastructure/development-admin-authorization.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const image = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

function requestBody(): FormData {
  const body = new FormData();
  body.set('categoryId', categoryId);
  body.set('name', 'Шашлык');
  body.set('basePriceMinor', '1000');
  body.set('adminEnabled', 'true');
  body.set('image', image, 'unsafe-name.jpg');
  return body;
}

function rejectedRepository(): ProductRepository {
  const rejected = (): Promise<never> => Promise.reject(new Error('persistence must not run'));
  return {
    create: rejected,
    findVisibleById: rejected,
    listAll: rejected,
    listVisible: rejected,
    updateDetails: rejected,
    updateVisibility: rejected,
  };
}

async function readError(response: Response): Promise<unknown> {
  const text = await response.text();
  assert.equal(text.includes('persistence must not run'), false);
  return ApiErrorResponseSchema.parse(JSON.parse(text) as unknown);
}

await test('image upload authenticates before multipart parsing, decoding, storage or persistence', async () => {
  let processed = false;
  let stored = false;
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    productCategoryReferenceRepository: { exists: () => Promise.resolve(true) },
    imageMutationGuard: { reserve: () => ({ release: () => undefined }) },
    imageProcessor: {
      process: () => {
        processed = true;
        return Promise.resolve({ contentType: 'image/webp' as const, data: new Uint8Array([1]) });
      },
    },
    objectStorage: {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(new Uint8Array([1])),
      put: () => {
        stored = true;
        return Promise.resolve();
      },
    },
    productRepository: rejectedRepository(),
  });
  const port = await listenOnEphemeralPort(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v2/admin/products`, {
      body: requestBody(),
      method: 'POST',
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await readError(response), {
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' },
    });
    assert.equal(processed, false);
    assert.equal(stored, false);
  } finally {
    await closeServer(server);
  }
});

await test('image upload checks the named image permission before processing', async () => {
  let processed = false;
  const server = createApiServer({
    adminIdentityResolver: {
      resolve: () => ({ kind: 'development_admin', role: 'viewer', subject: 'development-admin' }),
    },
    productCategoryReferenceRepository: { exists: () => Promise.resolve(true) },
    imageMutationGuard: { reserve: () => ({ release: () => undefined }) },
    imageProcessor: {
      process: () => {
        processed = true;
        return Promise.resolve({ contentType: 'image/webp' as const, data: new Uint8Array([1]) });
      },
    },
    objectStorage: {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(new Uint8Array([1])),
      put: () => Promise.resolve(),
    },
    productRepository: rejectedRepository(),
  });
  const port = await listenOnEphemeralPort(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v2/admin/products`, {
      body: requestBody(),
      headers: { 'x-vpzh-development-admin-identity': 'admin' },
      method: 'POST',
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await readError(response), {
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
    assert.equal(processed, false);
  } finally {
    await closeServer(server);
  }
});

await test('legacy JSON Product creation is disabled at the image write-freeze boundary', async () => {
  const server = createApiServer({
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: true,
      runtime: 'test',
    }),
    productCategoryReferenceRepository: {
      exists: () => Promise.reject(new Error('category persistence must not run')),
    },
    productImageWriteFrozen: true,
    productRepository: rejectedRepository(),
  });
  const port = await listenOnEphemeralPort(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin/products`, {
      body: JSON.stringify({
        adminEnabled: true,
        basePriceMinor: 1_000,
        categoryId,
        name: 'Legacy',
      }),
      headers: {
        'content-type': 'application/json',
        'x-vpzh-development-admin-identity': 'admin',
      },
      method: 'POST',
    });
    assert.equal(response.status, 410);
    assert.deepEqual(await readError(response), {
      error: { code: 'LEGACY_ENDPOINT_DISABLED', message: 'Legacy endpoint disabled' },
    });
  } finally {
    await closeServer(server);
  }
});

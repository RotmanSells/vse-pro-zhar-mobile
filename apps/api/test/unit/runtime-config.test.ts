import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRuntimeConfig } from '../../src/infrastructure/runtime-config.ts';
await test('loadRuntimeConfig uses the documented local defaults', () => {
  assert.deepEqual(loadRuntimeConfig({}), {
    host: '127.0.0.1',
    port: 3000,
    runtime: 'development',
    databaseUrl: undefined,
    developmentIdentityEnabled: false,
    developmentAdminIdentityEnabled: false,
    imageStorageEndpoint: 'https://storage.yandexcloud.net',
    imageStorageRegion: 'ru-central1',
    productImageBucket: 'vse-pro-zhar-product-images-dev',
    imageStorageAccessKeyId: undefined,
    imageStorageSecretAccessKey: undefined,
    imageStorageRequestTimeoutMs: 5_000,
    imageStorageMaxAttempts: 3,
    publicApiBaseUrl: 'http://127.0.0.1:3000',
    imageStorageDriver: 'temporary',
    imageStorageDirectory: 'artifacts/product-images',
    productImageWriteFrozen: false,
  });
});
await test('loadRuntimeConfig validates and coerces PORT from process environment', () => {
  assert.deepEqual(
    loadRuntimeConfig({
      PORT: '4100',
      VPZH_ENABLE_DEVELOPMENT_IDENTITY: 'true',
      VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: 'true',
    }),
    {
      host: '127.0.0.1',
      port: 4100,
      runtime: 'development',
      databaseUrl: undefined,
      developmentIdentityEnabled: true,
      developmentAdminIdentityEnabled: true,
      imageStorageEndpoint: 'https://storage.yandexcloud.net',
      imageStorageRegion: 'ru-central1',
      productImageBucket: 'vse-pro-zhar-product-images-dev',
      imageStorageAccessKeyId: undefined,
      imageStorageSecretAccessKey: undefined,
      imageStorageRequestTimeoutMs: 5_000,
      imageStorageMaxAttempts: 3,
      publicApiBaseUrl: 'http://127.0.0.1:4100',
      imageStorageDriver: 'temporary',
      imageStorageDirectory: 'artifacts/product-images',
      productImageWriteFrozen: false,
    },
  );
});
await test('loadRuntimeConfig rejects an out-of-range port', () => {
  assert.throws(() => loadRuntimeConfig({ PORT: '65536' }));
});
await test('loadRuntimeConfig fails closed for production even with the development flag', () => {
  assert.throws(() =>
    loadRuntimeConfig({ NODE_ENV: 'production', VPZH_ENABLE_DEVELOPMENT_IDENTITY: 'true' }),
  );
});

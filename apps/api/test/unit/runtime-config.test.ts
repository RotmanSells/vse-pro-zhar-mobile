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
    },
  );
});
await test('loadRuntimeConfig rejects an out-of-range port', () => {
  assert.throws(() => loadRuntimeConfig({ PORT: '65536' }));
});
await test('loadRuntimeConfig fails closed for production even with the development flag', () => {
  assert.deepEqual(
    loadRuntimeConfig({ NODE_ENV: 'production', VPZH_ENABLE_DEVELOPMENT_IDENTITY: 'true' }),
    {
      host: '127.0.0.1',
      port: 3000,
      runtime: 'production',
      databaseUrl: undefined,
      developmentIdentityEnabled: false,
      developmentAdminIdentityEnabled: false,
    },
  );
});

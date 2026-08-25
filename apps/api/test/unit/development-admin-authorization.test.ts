import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDevelopmentAdminIdentityResolver,
  isDevelopmentAdminBoundaryEnabled,
} from '../../src/infrastructure/development-admin-authorization.ts';

await test('Admin boundary accepts only the exact synthetic development identity', () => {
  const resolver = createDevelopmentAdminIdentityResolver({ enabled: true, runtime: 'development' });

  assert.deepEqual(resolver.resolve({ rawHeader: '  admin  ' }), {
    kind: 'development_admin',
    subject: 'development-admin',
    role: 'admin',
  });
  assert.equal(resolver.resolve({ rawHeader: undefined }), undefined);
  assert.equal(resolver.resolve({ rawHeader: '' }), undefined);
  assert.equal(resolver.resolve({ rawHeader: 'administrator' }), undefined);
  assert.equal(resolver.resolve({ rawHeader: ['admin', 'admin'] }), undefined);
});

await test('Admin boundary requires the exact opt-in in development and test', () => {
  assert.equal(isDevelopmentAdminBoundaryEnabled({ enabled: true, runtime: 'development' }), true);
  assert.equal(isDevelopmentAdminBoundaryEnabled({ enabled: true, runtime: 'test' }), true);
  assert.equal(isDevelopmentAdminBoundaryEnabled({ enabled: false, runtime: 'test' }), false);
});

await test('Admin boundary always fails closed in production', () => {
  const resolver = createDevelopmentAdminIdentityResolver({ enabled: true, runtime: 'production' });

  assert.equal(resolver.resolve({ rawHeader: 'admin' }), undefined);
  assert.equal(isDevelopmentAdminBoundaryEnabled({ enabled: true, runtime: 'production' }), false);
});

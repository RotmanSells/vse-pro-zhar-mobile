import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDevelopmentIdentityResolver,
  isDevelopmentIdentityBoundaryEnabled,
} from '../../src/infrastructure/development-identity-boundary.ts';

await test('the backend development identity boundary is disabled by default', () => {
  assert.equal(
    isDevelopmentIdentityBoundaryEnabled({ enabled: false, runtime: 'development' }),
    false,
  );
});

await test('the boundary accepts only trimmed phone input in development/test', () => {
  const resolver = createDevelopmentIdentityResolver({ enabled: true, runtime: 'test' });

  assert.deepEqual(resolver.resolve({ rawHeader: '  +7 900 000-00-00  ' }), {
    kind: 'development_identity',
    phone: '+7 900 000-00-00',
  });
  assert.equal(resolver.resolve({ rawHeader: '' }), undefined);
  assert.equal(resolver.resolve({ rawHeader: ['+7 900 000-00-00'] }), undefined);
});

await test('the boundary fails closed in production even when explicitly enabled', () => {
  const resolver = createDevelopmentIdentityResolver({ enabled: true, runtime: 'production' });

  assert.equal(resolver.resolve({ rawHeader: '+7 900 000-00-00' }), undefined);
  assert.equal(
    isDevelopmentIdentityBoundaryEnabled({ enabled: true, runtime: 'production' }),
    false,
  );
});

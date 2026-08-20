import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRuntimeConfig } from '../../src/infrastructure/runtime-config.ts';
await test('loadRuntimeConfig uses the documented local defaults', () => {
  assert.deepEqual(loadRuntimeConfig({}), {
    host: '127.0.0.1',
    port: 3000,
  });
});
await test('loadRuntimeConfig validates and coerces PORT from process environment', () => {
  assert.deepEqual(loadRuntimeConfig({ PORT: '4100' }), {
    host: '127.0.0.1',
    port: 4100,
  });
});
await test('loadRuntimeConfig rejects an out-of-range port', () => {
  assert.throws(() => loadRuntimeConfig({ PORT: '65536' }));
});

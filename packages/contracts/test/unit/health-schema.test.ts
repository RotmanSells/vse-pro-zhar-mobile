import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiErrorResponseSchema,
  HEALTH_SERVICE_NAME,
  HealthResponseSchema,
  parseHealthResponse,
} from '../../src/index.ts';

const timestamp = '2026-08-20T12:00:00.000Z';
await test('runtime contract accepts a documented health response', () => {
  assert.deepEqual(
    parseHealthResponse({
      service: HEALTH_SERVICE_NAME,
      status: 'ok',
      timestamp,
      version: '0.1.0',
    }),
    {
      service: HEALTH_SERVICE_NAME,
      status: 'ok',
      timestamp,
      version: '0.1.0',
    },
  );
});
await test('runtime contract rejects incomplete or extra health payloads', () => {
  assert.throws(() => HealthResponseSchema.parse({ status: 'ok' }));
  assert.throws(() =>
    HealthResponseSchema.parse({
      extra: true,
      service: HEALTH_SERVICE_NAME,
      status: 'ok',
      timestamp,
      version: '0.1.0',
    }),
  );
});
await test('runtime contract accepts the documented safe error shape', () => {
  assert.deepEqual(
    ApiErrorResponseSchema.parse({
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    }),
    {
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    },
  );
});

await test('safe error contract includes the stable Product imagery mappings', () => {
  for (const code of [
    'CONFLICT',
    'INVALID_IMAGE',
    'LEGACY_ENDPOINT_DISABLED',
    'PAYLOAD_TOO_LARGE',
    'STORAGE_UNAVAILABLE',
    'UNSUPPORTED_MEDIA_TYPE',
  ] as const) {
    assert.equal(
      ApiErrorResponseSchema.safeParse({ error: { code, message: 'Safe message' } }).success,
      true,
    );
  }
});

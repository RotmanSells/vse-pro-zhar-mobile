import assert from 'node:assert/strict';
import test from 'node:test';

import { HEALTH_SERVICE_NAME } from '@vse-pro-zhar/contracts';

import { buildHealthResponse } from '../../src/presentation/health-response.ts';

const fixedTimestamp = '2026-08-20T12:00:00.000Z';
await test('buildHealthResponse creates a contract-compliant liveness payload', () => {
  assert.deepEqual(
    buildHealthResponse('9.9.9', () => new Date(fixedTimestamp)),
    {
      service: HEALTH_SERVICE_NAME,
      status: 'ok',
      timestamp: fixedTimestamp,
      version: '9.9.9',
    },
  );
});

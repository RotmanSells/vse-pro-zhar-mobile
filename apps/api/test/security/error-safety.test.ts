import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { ApiErrorResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

await test('safe protocol errors do not echo secrets, headers, stack traces or runtime details', async () => {
  const probeValue = 'vpzh-011-must-not-leak';
  const previous = process.env.VPZH_011_SECRET_PROBE;
  process.env.VPZH_011_SECRET_PROBE = probeValue;

  const server = createApiServer();
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/not-found?probe=${probeValue}`, {
      headers: { Authorization: `Bearer ${probeValue}` },
    });
    const raw: unknown = JSON.parse(await response.text());
    const body = ApiErrorResponseSchema.parse(raw);

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Not found');
    assert.equal(JSON.stringify(body).includes(probeValue), false);
  } finally {
    if (previous === undefined) {
      delete process.env.VPZH_011_SECRET_PROBE;
    } else {
      process.env.VPZH_011_SECRET_PROBE = previous;
    }

    await closeServer(server);
  }
});

await test('unsupported methods receive a stable, non-cached 405 response', async () => {
  const server = createApiServer();
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      method: 'POST',
    });
    const raw: unknown = JSON.parse(await response.text());
    const body = ApiErrorResponseSchema.parse(raw);

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed',
      },
    });
  } finally {
    await closeServer(server);
  }
});

await test('internal errors are returned safely and logged without arbitrary error text', async () => {
  const probeValue = 'vpzh-011-internal-log-secret';
  const emitted: unknown[] = [];
  const errorLog = mock.method(console, 'error', (...args: unknown[]) => {
    emitted.push(...args);
  });
  const server = createApiServer({
    now: () => {
      throw new Error(`unexpected-health-probe ${probeValue}\nStack:\n  at health-response.ts:1:1`);
    },
    version: 'internal-error-version',
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health?probe=${probeValue}`);
    const responseText = await response.text();
    const raw: unknown = JSON.parse(responseText);
    const body = ApiErrorResponseSchema.parse(raw);
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(body, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
    assert.equal(responseText.includes(probeValue), false);

    const emittedLog = emitted.map(String).join(' ');
    assert.equal(emittedLog.includes(probeValue), false);
    assert.equal(emittedLog.includes('unexpected-health-probe'), false);
    assert.equal(emittedLog.includes('health-response.ts'), false);
    assert.match(emittedLog, /request_handler_failed/u);
  } finally {
    errorLog.mock.restore();
    await closeServer(server);
  }
});

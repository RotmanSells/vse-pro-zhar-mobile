import assert from 'node:assert/strict';
import test from 'node:test';
import { HealthResponseSchema } from '@vse-pro-zhar/contracts';

import { createApiServer } from '../../src/composition/create-api-server.ts';
import { closeServer, listenOnEphemeralPort } from '../helpers/listen.ts';

const fixedTimestamp = '2026-08-20T12:00:00.000Z';
await test('serves a schema-valid health response through a real HTTP server', async () => {
  const server = createApiServer({
    now: () => new Date(fixedTimestamp),
    version: 'integration-version',
  });
  const port = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health?ignored=value`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

    const raw: unknown = JSON.parse(await response.text());
    const body = HealthResponseSchema.parse(raw);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'vse-pro-zhar-api');
    assert.equal(body.version, 'integration-version');
    assert.equal(body.timestamp, fixedTimestamp);
  } finally {
    await closeServer(server);
  }
});

import type { AddressInfo } from 'node:net';

import { createApiServer } from '../../../apps/api/src/composition/create-api-server';
import { HealthResponseSchema } from '../../../packages/contracts/src';

async function request(url: string): Promise<{ status: number; headers: Headers; body: unknown }> {
  const response = await fetch(url);
  const body = JSON.parse(await response.text()) as unknown;
  return { status: response.status, headers: response.headers, body };
}

describe('API health HTTP boundary', () => {
  it('serves the healthy shared contract through the composition root', async () => {
    const server = createApiServer({ version: 'test-version' });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    try {
      const response = await request(`http://127.0.0.1:${address.port}/health?ignored=value`);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = HealthResponseSchema.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('vse-pro-zhar-api');
      expect(body.version).toBe('test-version');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });
});

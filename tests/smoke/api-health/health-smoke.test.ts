import type { AddressInfo } from 'node:net';

import { createApiServer } from '../../../apps/api/src/composition/create-api-server';

describe('API health smoke', () => {
  it('starts and returns the liveness response without a database', async () => {
    const server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      expect(response.status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });
});

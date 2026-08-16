import { getMobileHealthState, type HealthClient } from './get-health-state';

describe('getMobileHealthState', () => {
  it('maps a validated healthy API result to the healthy state', async () => {
    const client: HealthClient = {
      getHealth: () =>
        Promise.resolve({
          status: 'ok',
          service: 'vse-pro-zhar-api',
          version: '0.1.0',
          timestamp: '2026-08-16T12:00:00.000Z',
        }),
    };

    await expect(getMobileHealthState(client)).resolves.toMatchObject({ kind: 'healthy' });
  });

  it('maps adapter failures to the unavailable state', async () => {
    const client: HealthClient = { getHealth: async () => Promise.reject(new Error('offline')) };

    await expect(getMobileHealthState(client)).resolves.toEqual({ kind: 'unavailable' });
  });
});

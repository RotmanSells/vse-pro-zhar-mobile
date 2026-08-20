import { createHealthApiClient } from '../src/infrastructure/health-api-client.ts';

const validHealth = {
  service: 'vse-pro-zhar-api',
  status: 'ok',
  timestamp: '2026-08-20T12:00:00.000Z',
  version: '0.1.0',
} as const;

describe('health API client', () => {
  it('returns healthy only for a shared-contract-valid /health response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(validHealth), { status: 200 }));
    const client = createHealthApiClient({ apiBaseUrl: 'http://10.0.2.2:3100', fetchImpl });

    await expect(client.check()).resolves.toEqual({ kind: 'healthy', response: validHealth });
    expect(fetchImpl).toHaveBeenCalledWith('http://10.0.2.2:3100/health', expect.any(Object));
  });

  it('safely rejects a schema-invalid /health response', async () => {
    const client = createHealthApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 })),
    });

    await expect(client.check()).resolves.toEqual({
      kind: 'unhealthy',
      reason: 'invalid_response',
    });
  });

  it('maps an aborted deterministic timer to timeout', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createHealthApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl,
      timeoutMs: 5,
    });

    const result = client.check();
    await jest.advanceTimersByTimeAsync(5);
    await expect(result).resolves.toEqual({ kind: 'unhealthy', reason: 'timeout' });
    jest.useRealTimers();
  });

  it('maps a connection failure to a safe network state', async () => {
    const client = createHealthApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    });

    await expect(client.check()).resolves.toEqual({ kind: 'unhealthy', reason: 'network' });
  });
});

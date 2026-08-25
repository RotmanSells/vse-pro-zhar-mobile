import { createCategoryApiClient } from '../src/infrastructure/category-api-client.ts';

describe('Mobile Category API client', () => {
  it('reads public Categories without sending either development identity', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }]),
          { status: 200 },
        ),
      );
    const client = createCategoryApiClient({ apiBaseUrl: 'http://10.0.2.2:3100', fetchImpl });

    await expect(client.listCategories()).resolves.toEqual({
      kind: 'loaded',
      categories: [{ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://10.0.2.2:3100/categories',
      expect.objectContaining({ headers: { Accept: 'application/json' }, method: 'GET' }),
    );
  });

  it('rejects malformed responses and maps non-success HTTP safely', async () => {
    const malformed = createCategoryApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify([{ id: 'bad', name: 'Супы' }]), { status: 200 }),
        ),
    });
    await expect(malformed.listCategories()).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_response',
    });

    const unavailable = createCategoryApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(new Response('{}', { status: 500 })),
    });
    await expect(unavailable.listCategories()).resolves.toEqual({
      kind: 'failure',
      reason: 'http',
    });
  });

  it('maps a bounded aborted request to timeout', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createCategoryApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl,
      timeoutMs: 5,
    });

    const result = client.listCategories();
    await jest.advanceTimersByTimeAsync(5);
    await expect(result).resolves.toEqual({ kind: 'failure', reason: 'timeout' });
    jest.useRealTimers();
  });
});

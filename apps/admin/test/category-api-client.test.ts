import {
  createCategoryApiClient,
  readConfiguredAdminApiBaseUrl,
} from '../src/infrastructure/catalog/category-api-client';

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 201,
    ...init,
  });
}

describe('Admin Category API client', () => {
  it('sends the ADR-003 header and validates the real API response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(response({ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }));
    const client = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });

    await expect(client.createCategory({ name: '  Супы  ' })).resolves.toEqual({
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
      kind: 'created',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3100/admin/categories',
      expect.objectContaining({
        body: JSON.stringify({ name: 'Супы' }),
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-VPZH-Development-Admin-Identity': 'admin',
        },
      }),
    );
  });

  it('maps safe HTTP failures and rejects malformed success responses', async () => {
    const forbidden = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: jest.fn().mockResolvedValue(response({ error: {} }, { status: 403 })),
    });
    await expect(forbidden.createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'forbidden',
    });

    const unauthorized = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: jest.fn().mockResolvedValue(response({ error: {} }, { status: 401 })),
    });
    await expect(unauthorized.createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'unauthorized',
    });

    const malformed = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: jest.fn().mockResolvedValue(response({ id: 'not-a-uuid', name: 'Супы' })),
    });
    await expect(malformed.createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_response',
    });
  });

  it('uses bounded timeout and validates configuration', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network'));
    const client = createCategoryApiClient({ apiBaseUrl: undefined, fetchImpl });
    await expect(client.createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'configuration',
    });
    expect(readConfiguredAdminApiBaseUrl('http://127.0.0.1:3100/')).toBe('http://127.0.0.1:3100');
    expect(readConfiguredAdminApiBaseUrl('https://api.example.test/')).toBe(
      'https://api.example.test',
    );
    expect(readConfiguredAdminApiBaseUrl('javascript:alert(1)')).toBeUndefined();
    expect(readConfiguredAdminApiBaseUrl('not a URL')).toBeUndefined();
    expect(readConfiguredAdminApiBaseUrl('http://user:password@127.0.0.1:3100')).toBeUndefined();

    const timeoutFetch = jest.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
    const timeoutClient = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: timeoutFetch,
      timeoutMs: 1,
    });
    await expect(timeoutClient.createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'timeout',
    });
  });
});

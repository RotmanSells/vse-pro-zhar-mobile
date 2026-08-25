import type { CategoryFetch } from '../src/infrastructure/catalog/category-api-client';
import { createAdminCategoryOperation } from '../src/main';

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 201,
    ...init,
  });
}

describe('Admin Category composition boundary', () => {
  it('wires the configured server-side operation to the real Infrastructure adapter', async () => {
    const fetchImpl: jest.MockedFunction<CategoryFetch> = jest
      .fn()
      .mockResolvedValue(response({ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }));
    const createCategory = createAdminCategoryOperation({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });

    await expect(createCategory({ name: '  Супы  ' })).resolves.toEqual({
      kind: 'created',
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3100/admin/categories');
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-VPZH-Development-Admin-Identity': 'admin',
    });
  });

  it('returns a safe configuration failure before any server-side fetch', async () => {
    const fetchImpl = jest.fn();
    const createCategory = createAdminCategoryOperation({
      apiBaseUrl: 'javascript:alert(1)',
      fetchImpl,
    });

    await expect(createCategory({ name: 'Супы' })).resolves.toEqual({
      kind: 'failure',
      reason: 'configuration',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

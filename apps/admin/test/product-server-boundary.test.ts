import type { ProductFetch } from '../src/infrastructure/catalog/product-api-client';
import { createAdminProductOperation } from '../src/main';

describe('Admin Product composition boundary', () => {
  it('keeps the mutation on the server-side Application/HTTP adapter path', async () => {
    const fetchImpl: jest.MockedFunction<ProductFetch> = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          adminEnabled: true,
          basePriceMinor: 45_000,
          categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          description: null,
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          isHit: false,
          isNew: false,
          name: 'Шашлык',
          weightGrams: null,
        }),
        { status: 201 },
      ),
    );
    const createProduct = createAdminProductOperation({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });

    await expect(
      createProduct({
        adminEnabled: true,
        basePriceRub: '450',
        categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: '  Шашлык  ',
      }),
    ).resolves.toMatchObject({ kind: 'created' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3100/admin/products');
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('POST');
  });
});

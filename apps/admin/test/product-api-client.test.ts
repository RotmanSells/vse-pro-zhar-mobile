import { createProductApiClient } from '../src/infrastructure/catalog/product-api-client';
import type { ProductFetch } from '../src/infrastructure/catalog/product-api-client';

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 201,
    ...init,
  });
}

const request = {
  adminEnabled: true,
  basePriceMinor: 45_000,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  name: 'Шашлык',
};

describe('Admin Product API client', () => {
  it('sends the ADR-003 header and validates the Product response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      response({
        adminEnabled: true,
        basePriceMinor: 45_000,
        categoryId: request.categoryId,
        description: null,
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: false,
        isNew: false,
        name: 'Шашлык',
        weightGrams: null,
      }),
    );
    const client = createProductApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });

    await expect(client.createProduct(request)).resolves.toEqual({
      kind: 'created',
      product: {
        adminEnabled: true,
        basePriceMinor: 45_000,
        categoryId: request.categoryId,
        description: null,
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: false,
        isNew: false,
        name: 'Шашлык',
        weightGrams: null,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:3100/admin/products',
      expect.objectContaining({
        body: JSON.stringify({
          categoryId: request.categoryId,
          name: request.name,
          basePriceMinor: request.basePriceMinor,
          adminEnabled: request.adminEnabled,
        }),
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-VPZH-Development-Admin-Identity': 'admin',
        },
      }),
    );
  });

  it('maps safe HTTP failures and malformed responses', async () => {
    const notFound = createProductApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: jest.fn().mockResolvedValue(response({}, { status: 404 })),
    });
    await expect(notFound.createProduct(request)).resolves.toEqual({
      kind: 'failure',
      reason: 'not_found',
    });

    const malformed = createProductApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl: jest.fn().mockResolvedValue(response({ id: 'bad' })),
    });
    await expect(malformed.createProduct(request)).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_response',
    });
  });

  it('lists Products and updates details through the named Admin boundary', async () => {
    const updated = {
      adminEnabled: true,
      basePriceMinor: 45_000,
      categoryId: request.categoryId,
      description: 'Состав',
      id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      isHit: true,
      isNew: false,
      name: 'Шашлык',
      weightGrams: 350,
    };
    const fetchImpl: jest.MockedFunction<ProductFetch> = jest
      .fn()
      .mockResolvedValueOnce(response([updated], { status: 200 }))
      .mockResolvedValueOnce(response(updated, { status: 200 }));
    const client = createProductApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });
    await expect(client.listProducts()).resolves.toEqual({ kind: 'loaded', products: [updated] });
    await expect(
      client.updateProductDetails({
        description: 'Состав',
        id: updated.id,
        isHit: true,
        isNew: false,
        weightGrams: 350,
      }),
    ).resolves.toEqual({ kind: 'updated', product: updated });
    const lastCall = fetchImpl.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(`http://127.0.0.1:3100/admin/products/${updated.id}/details`);
    expect(lastCall?.[1]?.method).toBe('PATCH');
    expect(lastCall?.[1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-VPZH-Development-Admin-Identity': 'admin',
    });
  });
});

import { createProductApiClient } from '../src/infrastructure/catalog/product-api-client';

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
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Шашлык',
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
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Шашлык',
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
});

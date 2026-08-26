import { createProductApiClient } from '../src/infrastructure/product-api-client.ts';

const product = {
  adminEnabled: true,
  basePriceMinor: 45_050,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  name: 'Шашлык',
};

describe('Mobile Product API client', () => {
  it('reads public Products without identity headers and validates the response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([product]), { status: 200 }));
    const client = createProductApiClient({ apiBaseUrl: 'http://10.0.2.2:3100', fetchImpl });

    await expect(client.listProducts()).resolves.toEqual({ kind: 'loaded', products: [product] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://10.0.2.2:3100/products',
      expect.objectContaining({ headers: { Accept: 'application/json' }, method: 'GET' }),
    );
  });

  it('rejects malformed responses and maps bounded network failure', async () => {
    const malformed = createProductApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([{ id: 'bad' }]), { status: 200 })),
    });
    await expect(malformed.listProducts()).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_response',
    });

    const unavailable = createProductApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(new Response('{}', { status: 500 })),
    });
    await expect(unavailable.listProducts()).resolves.toEqual({ kind: 'failure', reason: 'http' });
  });
});

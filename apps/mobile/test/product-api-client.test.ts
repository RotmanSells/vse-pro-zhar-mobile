import { createProductApiClient } from '../src/infrastructure/product-api-client.ts';
import type { ProductFetch } from '../src/infrastructure/product-api-client.ts';

const product = {
  adminEnabled: true,
  basePriceMinor: 45_050,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  description: null,
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  isHit: false,
  isNew: false,
  name: 'Шашлык',
  weightGrams: null,
};
const productDetails = {
  ...product,
  categoryName: 'Шашлык',
  description: 'Состав блюда',
  isHit: true,
  weightGrams: 350,
};

describe('Mobile Product API client', () => {
  it('reads public Products without identity headers and validates the response', async () => {
    const fetchImpl: jest.MockedFunction<ProductFetch> = jest
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

  it('loads a single visible Product details response and maps not found safely', async () => {
    const fetchImpl: jest.MockedFunction<ProductFetch> = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(productDetails), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }));
    const client = createProductApiClient({ apiBaseUrl: 'http://10.0.2.2:3100', fetchImpl });
    await expect(client.getProduct(product.id)).resolves.toEqual({
      kind: 'loaded',
      product: productDetails,
    });
    await expect(client.getProduct('missing')).resolves.toEqual({
      kind: 'failure',
      reason: 'not_found',
    });
  });

  it('uses the additive v2 image-aware contract when configured', async () => {
    const imageProduct = {
      ...product,
      imageUrl:
        'http://127.0.0.1:3100/products/d6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047/image/a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    };
    const imageDetails = { ...productDetails, imageUrl: imageProduct.imageUrl };
    const fetchImpl: jest.MockedFunction<ProductFetch> = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([imageProduct]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(imageDetails), { status: 200 }));
    const client = createProductApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      apiVersion: 'v2',
      fetchImpl,
    });
    await expect(client.listProducts()).resolves.toEqual({
      kind: 'loaded',
      products: [imageProduct],
    });
    await expect(client.getProduct(product.id)).resolves.toEqual({
      kind: 'loaded',
      product: imageDetails,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://10.0.2.2:3100/v2/products');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(`http://10.0.2.2:3100/v2/products/${product.id}`);
  });
});

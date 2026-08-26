import { loadProducts, type ProductListPort } from '../src/application/catalog/product.ts';

describe('Mobile Product Application', () => {
  it('keeps only the successful Backend Product response', async () => {
    const port: ProductListPort = {
      listProducts: jest.fn().mockResolvedValue({
        kind: 'loaded',
        products: [
          {
            adminEnabled: true,
            basePriceMinor: 45_050,
            categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
            id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
            name: 'Шашлык',
          },
        ],
      }),
    };

    await expect(loadProducts(port)).resolves.toEqual({
      kind: 'loaded',
      products: [
        {
          adminEnabled: true,
          basePriceMinor: 45_050,
          categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          name: 'Шашлык',
        },
      ],
    });
  });
});

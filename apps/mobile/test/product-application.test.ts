import {
  loadProductDetails,
  loadProducts,
  type ProductDetailsPort,
  type ProductListPort,
} from '../src/application/catalog/product.ts';

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
            description: null,
            id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
            isHit: false,
            isNew: false,
            name: 'Шашлык',
            weightGrams: null,
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
          description: null,
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          isHit: false,
          isNew: false,
          name: 'Шашлык',
          weightGrams: null,
        },
      ],
    });
  });

  it('keeps the Backend-confirmed Product details result', async () => {
    const details = {
      adminEnabled: true,
      basePriceMinor: 45_050,
      categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      categoryName: 'Шашлык',
      description: 'Состав',
      id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      isHit: true,
      isNew: false,
      name: 'Шашлык',
      weightGrams: 350,
    };
    const port: ProductDetailsPort = {
      getProduct: jest.fn().mockResolvedValue({ kind: 'loaded', product: details }),
    };
    await expect(loadProductDetails(details.id, port)).resolves.toEqual({
      kind: 'loaded',
      product: details,
    });
  });
});

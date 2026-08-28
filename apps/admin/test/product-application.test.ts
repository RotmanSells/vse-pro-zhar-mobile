import {
  parseRubPriceToMinorUnits,
  parseWeightGrams,
  submitProduct,
  submitProductDetails,
  submitProductVisibility,
} from '../src/application/catalog/product';

describe('Admin Product Application', () => {
  it('converts RUB input to integer minor units without floating-point authority', () => {
    expect(parseRubPriceToMinorUnits('450')).toBe(45_000);
    expect(parseRubPriceToMinorUnits('450,50')).toBe(45_050);
    expect(parseRubPriceToMinorUnits('0.01')).toBe(1);
    expect(parseRubPriceToMinorUnits('450.999')).toBeUndefined();
    expect(parseRubPriceToMinorUnits('0')).toBeUndefined();
  });

  it('submits the explicit enabled value through the Product contract', async () => {
    const createProduct = jest.fn().mockResolvedValue({
      kind: 'created',
      product: {
        adminEnabled: false,
        basePriceMinor: 45_050,
        categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        description: null,
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: false,
        isNew: false,
        name: 'Шашлык',
        weightGrams: null,
      },
    });

    await expect(
      submitProduct(
        {
          adminEnabled: false,
          basePriceRub: '450,50',
          categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          name: '  Шашлык  ',
        },
        { createProduct },
      ),
    ).resolves.toEqual({
      kind: 'created',
      product: {
        adminEnabled: false,
        basePriceMinor: 45_050,
        categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        description: null,
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: false,
        isNew: false,
        name: 'Шашлык',
        weightGrams: null,
      },
    });
    expect(createProduct).toHaveBeenCalledWith({
      adminEnabled: false,
      basePriceMinor: 45_050,
      categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      name: 'Шашлык',
    });
  });

  it('parses optional weight and submits only approved detail fields', async () => {
    expect(parseWeightGrams('350')).toBe(350);
    expect(parseWeightGrams('')).toBeNull();
    expect(parseWeightGrams('0')).toBeUndefined();
    const updateProductDetails = jest.fn().mockResolvedValue({
      kind: 'updated',
      product: {
        adminEnabled: true,
        basePriceMinor: 45_000,
        categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        description: 'Состав',
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: true,
        isNew: false,
        name: 'Шашлык',
        weightGrams: 350,
      },
    });
    await expect(
      submitProductDetails(
        {
          description: '  Состав  ',
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          isHit: true,
          isNew: false,
          weightGrams: '350',
        },
        { updateProductDetails },
      ),
    ).resolves.toMatchObject({ kind: 'updated' });
    expect(updateProductDetails).toHaveBeenCalledWith({
      description: 'Состав',
      id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      isHit: true,
      isNew: false,
      weightGrams: 350,
    });
  });

  it('submits the desired catalog visibility through its dedicated boundary', async () => {
    const updateProductVisibility = jest.fn().mockResolvedValue({
      kind: 'updated',
      product: {
        adminEnabled: false,
        basePriceMinor: 45_000,
        categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        description: null,
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        isHit: false,
        isNew: false,
        name: 'Шашлык',
        weightGrams: null,
      },
    });
    await expect(
      submitProductVisibility(
        {
          adminEnabled: false,
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        },
        { updateProductVisibility },
      ),
    ).resolves.toMatchObject({ kind: 'updated' });
    expect(updateProductVisibility).toHaveBeenCalledWith({
      adminEnabled: false,
      id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    });
  });
});

import type { ProductResponse } from '@vse-pro-zhar/contracts';

import {
  addProductToCart,
  calculateCartSummary,
  changeCartQuantity,
  formatRubPrice,
  getRankProgress,
  removeCartLine,
  type CartLine,
} from '../src/application/customer-experience.ts';

const product: ProductResponse = {
  adminEnabled: true,
  basePriceMinor: 45_000,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  description: 'Сочный шашлык',
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  isHit: true,
  isNew: false,
  name: 'Шашлык из свинины',
  weightGrams: 200,
};

describe('Mobile customer experience application', () => {
  it('formats RUB prices in the prototype style', () => {
    expect(formatRubPrice(45_000)).toBe('450₽');
    expect(formatRubPrice(45_050)).toBe('450,50₽');
  });

  it('handles cart additions, quantity changes and removal', () => {
    let cart: CartLine[] = [];
    cart = addProductToCart(cart, product);
    cart = addProductToCart(cart, product);
    expect(cart[0]?.quantity).toBe(2);
    cart = changeCartQuantity(cart, product.id, -1);
    expect(cart[0]?.quantity).toBe(1);
    cart = changeCartQuantity(cart, product.id, -1);
    expect(cart).toEqual([]);
    expect(removeCartLine(cart, product.id)).toEqual([]);
  });

  it('calculates prototype delivery, discount and cashback previews', () => {
    const cart: CartLine[] = [{ product, quantity: 5 }];
    const summary = calculateCartSummary(cart, 'SPARK10', 'delivery');
    expect(summary.subtotalMinor).toBe(225_000);
    expect(summary.discountMinor).toBe(22_500);
    expect(summary.deliveryMinor).toBe(0);
    expect(summary.totalMinor).toBe(202_500);
    expect(summary.cashbackMinor).toBe(10_125);
    expect(summary.activePromo).toBe('SPARK10');
  });

  it('keeps the rank progress bounded and points to the next rank', () => {
    expect(getRankProgress(450)).toMatchObject({
      name: 'Гость у костра',
      nextRankName: 'Разжигатель',
      nextRankXp: 500,
      percent: 90,
    });
    expect(getRankProgress(4_000)).toMatchObject({
      name: 'Повелитель Жара',
      nextRankName: undefined,
      percent: 100,
    });
  });
});

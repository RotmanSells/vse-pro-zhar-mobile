import type { CategoryResponse } from '@vse-pro-zhar/contracts';

import {
  normalizeCatalogSearchText,
  searchCatalogProducts,
} from '../src/application/catalog/catalog-search.ts';
import type { MobileProductResponse } from '../src/application/catalog/product.ts';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const secondCategoryId = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';

const categories: readonly CategoryResponse[] = [
  { id: categoryId, name: 'Шашлык' },
  { id: secondCategoryId, name: 'Овощи на гриле' },
];

function product(overrides: Partial<MobileProductResponse> = {}): MobileProductResponse {
  return {
    adminEnabled: true,
    basePriceMinor: 45_000,
    categoryId,
    description: null,
    id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
    isHit: false,
    isNew: false,
    name: 'Шашлык',
    weightGrams: null,
    ...overrides,
  };
}

describe('searchCatalogProducts', () => {
  it('normalizes Unicode case, surrounding/repeated whitespace and keeps substring matching exact', () => {
    const products = [
      product({
        description: '  Сочный   ШАШЛЫК на углях  ',
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Шашлык с овощами',
      }),
      product({
        description: 'Свежие овощи',
        id: 'c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Овощи',
      }),
    ];

    expect(searchCatalogProducts(products, categories, '  СОЧНЫЙ   шашлык ')).toEqual([
      products[0],
    ]);
    expect(searchCatalogProducts(products, categories, 'шашлык с')).toEqual([products[0]]);
    expect(searchCatalogProducts([product({ name: 'Ёлка' })], [], 'ел')).toEqual([]);
    expect(searchCatalogProducts([product({ name: 'Ёлка' })], [], 'ёл')).toHaveLength(1);
    expect(normalizeCatalogSearchText('  A\tБ  ')).toBe('a б');
  });

  it('matches only name, nullable description and resolved Category name', () => {
    const products = [
      product({
        description: 'Маринованный перец',
        id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Мясо на углях',
      }),
      product({
        categoryId: secondCategoryId,
        description: null,
        id: 'c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Кабачок',
      }),
    ];

    expect(searchCatalogProducts(products, categories, 'перец')).toEqual([products[0]]);
    expect(searchCatalogProducts(products, categories, 'овощи')).toEqual([products[1]]);
    expect(searchCatalogProducts(products, categories, 'мясо')).toEqual([products[0]]);
    expect(searchCatalogProducts(products, categories, 'неизвестно')).toEqual([]);
  });

  it('does not search IDs, price, weight, labels, image URL or visibility', () => {
    const searchableProduct = product({
      basePriceMinor: 12_345,
      description: 'Описание блюда',
      imageUrl: 'https://example.com/hit.jpg',
      isHit: true,
      isNew: true,
      name: 'Блюдо',
      weightGrams: 200,
    });

    for (const query of [
      searchableProduct.id,
      '12345',
      '200',
      'хит',
      'новинка',
      'example.com',
      'true',
    ]) {
      expect(searchCatalogProducts([searchableProduct], categories, query)).toEqual([]);
    }
  });

  it('treats an empty query as no filter, preserves input order and intersects category', () => {
    const products = [
      product({ id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Первый' }),
      product({
        categoryId: secondCategoryId,
        id: 'c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Второй',
      }),
      product({ id: 'b8f6d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Третий' }),
    ];

    expect(searchCatalogProducts(products, categories, '')).toEqual(products);
    expect(searchCatalogProducts(products, categories, '   ', secondCategoryId)).toEqual([
      products[1],
    ]);
    expect(searchCatalogProducts(products, categories, 'й', categoryId)).toEqual([
      products[0],
      products[2],
    ]);
  });
});

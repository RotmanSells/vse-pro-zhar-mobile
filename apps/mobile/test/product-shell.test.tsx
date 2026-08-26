import { fireEvent, render } from '@testing-library/react-native';
import type { CategoryListResponse, ProductResponse } from '@vse-pro-zhar/contracts';
import type { CategoryListPort } from '../src/application/catalog/category.ts';
import type { ProductListPort } from '../src/application/catalog/product.ts';
import { MobileCatalogShell } from '../src/presentation/catalog/catalog-shell.tsx';
const categoryA = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const categoryB = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const emptyCategory = 'b7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
function categoryList(categories: CategoryListResponse): CategoryListPort {
  return { listCategories: jest.fn().mockResolvedValue({ kind: 'loaded', categories }) };
}

function product(
  id: string,
  name: string,
  categoryId: string,
  basePriceMinor: number,
): ProductResponse {
  return { adminEnabled: true, basePriceMinor, categoryId, id, name };
}
const categoryPort = categoryList([{ id: categoryA, name: 'Супы' }]);
describe('Mobile Product shell', () => {
  it('shows loading, Backend name/price, safe retry and no order/details button', async () => {
    let shouldFail = true;
    let resolveFirst:
      ((value: { readonly kind: 'failure'; readonly reason: 'network' }) => void) | undefined;
    const firstLoad = new Promise<{
      readonly kind: 'failure';
      readonly reason: 'network';
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const productPort: ProductListPort = {
      listProducts: jest
        .fn()
        .mockImplementationOnce(() => firstLoad)
        .mockImplementation(() =>
          Promise.resolve(
            shouldFail
              ? { kind: 'failure', reason: 'network' }
              : {
                  kind: 'loaded',
                  products: [
                    {
                      adminEnabled: true,
                      basePriceMinor: 45_050,
                      categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
                      id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
                      name: 'Шашлык из backend',
                    },
                  ],
                },
          ),
        ),
    };
    const view = await render(
      <MobileCatalogShell categoryPort={categoryPort} productPort={productPort} />,
    );
    expect(view.getByText('Загружаем блюда…')).toBeOnTheScreen();
    resolveFirst?.({ kind: 'failure', reason: 'network' });
    expect(await view.findByText('Блюда: backend сейчас недоступен.')).toBeOnTheScreen();
    shouldFail = false;
    await fireEvent.press(view.getByText('Повторить'));
    expect(await view.findByText('Шашлык из backend')).toBeOnTheScreen();
    expect(view.getByText('450,50 ₽')).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Заказать' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });
  it('shows the empty state for an empty persisted catalog', async () => {
    const productPort: ProductListPort = {
      listProducts: jest.fn().mockResolvedValue({ kind: 'loaded', products: [] }),
    };
    const view = await render(
      <MobileCatalogShell categoryPort={categoryPort} productPort={productPort} />,
    );
    expect(await view.findByText('В категории «Супы» пока нет блюд.')).toBeOnTheScreen();
  });
  it('browses Products by selected Category with accessible controls', async () => {
    const categories = categoryList([
      { id: categoryA, name: 'Category A' },
      { id: categoryB, name: 'Category B' },
      { id: emptyCategory, name: 'Empty Category' },
    ]);
    const products: ProductListPort = {
      listProducts: jest.fn().mockResolvedValue({
        kind: 'loaded',
        products: [
          product('c6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047', 'Product A1', categoryA, 100),
          product('c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047', 'Product A2', categoryA, 200),
          product('c8f6d7cc-e4c1-4ac4-a7e4-61ae5f290047', 'Product B1', categoryB, 300),
        ],
      }),
    };
    const view = await render(
      <MobileCatalogShell categoryPort={categories} productPort={products} />,
    );
    expect(await view.findByText('Product A1')).toBeOnTheScreen();
    expect(view.getByText('Product A2')).toBeOnTheScreen();
    expect(view.queryByText('Product B1')).toBeNull();
    const firstCategory = view.getByRole('button', { name: 'Category A' });
    const secondCategory = view.getByRole('button', { name: 'Category B' });
    expect(firstCategory.props.accessibilityState).toEqual({ selected: true });
    expect(secondCategory.props.accessibilityState).toEqual({ selected: false });
    expect(secondCategory.props.accessibilityRole).toBe('button');
    await fireEvent.press(secondCategory);
    expect(await view.findByText('Product B1')).toBeOnTheScreen();
    expect(view.queryByText('Product A1')).toBeNull();
    expect(view.queryByText('Product A2')).toBeNull();
    expect(view.getByRole('button', { name: 'Category B' }).props.accessibilityState).toEqual({
      selected: true,
    });
    await fireEvent.press(view.getByRole('button', { name: 'Empty Category' }));
    expect(await view.findByText('В категории «Empty Category» пока нет блюд.')).toBeOnTheScreen();
    expect(view.queryByText('Product B1')).toBeNull();
    expect(view.queryByRole('button', { name: 'Заказать' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });
});

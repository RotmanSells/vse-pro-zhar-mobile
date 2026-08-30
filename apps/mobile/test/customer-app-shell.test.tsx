import { fireEvent, render } from '@testing-library/react-native';
import type { CategoryListPort } from '../src/application/catalog/category.ts';
import type { ProductListPort } from '../src/application/catalog/product.ts';
import { MobileCustomerAppShell } from '../src/presentation/customer-app/customer-app-shell.tsx';

const categoryId = 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const product = {
  adminEnabled: true,
  basePriceMinor: 45_000,
  categoryId,
  description: 'Сочный шашлык на углях, 200г',
  id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  isHit: true,
  isNew: false,
  name: 'Шашлык из backend',
  weightGrams: 200,
};

const categoryPort: CategoryListPort = {
  listCategories: jest.fn().mockResolvedValue({
    kind: 'loaded',
    categories: [{ id: categoryId, name: 'Шашлык' }],
  }),
};
const productPort: ProductListPort = {
  listProducts: jest.fn().mockResolvedValue({ kind: 'loaded', products: [product] }),
};

describe('Mobile customer application shell', () => {
  it('renders the prototype navigation and moves through every destination', async () => {
    const view = await render(
      <MobileCustomerAppShell categoryPort={categoryPort} productPort={productPort} />,
    );

    expect(await view.findByText('Шашлык из backend')).toBeOnTheScreen();
    expect(view.getByText('450₽')).toBeOnTheScreen();
    expect(view.getByText('🔥 Хит')).toBeOnTheScreen();

    await fireEvent.press(
      view.getByRole('button', { name: 'Добавить Шашлык из backend в корзину' }),
    );
    expect(
      view.getByRole('button', { name: 'Открыть корзину, 1 товаров на 450 рублей' }),
    ).toBeOnTheScreen();

    await fireEvent.press(view.getByTestId('customer-tab-roulette'));
    expect(view.getByText('🎡 Поймай искру')).toBeOnTheScreen();
    await fireEvent.press(view.getByTestId('customer-tab-passport'));
    expect(view.getByText('🎯 Квесты')).toBeOnTheScreen();
    await fireEvent.press(view.getByTestId('customer-tab-cart'));
    expect(view.getByText('🛒 Моя корзина')).toBeOnTheScreen();
    expect(view.getByText('Шашлык из backend')).toBeOnTheScreen();
    await fireEvent.press(view.getByTestId('customer-tab-profile'));
    expect(view.getByText('Гриль-Мастер')).toBeOnTheScreen();
  });

  it('filters Backend products by the selected category', async () => {
    const secondCategoryId = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
    const secondProduct = {
      ...product,
      categoryId: secondCategoryId,
      id: 'c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      name: 'Крылья backend',
    };
    const categories: CategoryListPort = {
      listCategories: jest.fn().mockResolvedValue({
        kind: 'loaded',
        categories: [
          { id: categoryId, name: 'Шашлык' },
          { id: secondCategoryId, name: 'Крылья' },
        ],
      }),
    };
    const products: ProductListPort = {
      listProducts: jest
        .fn()
        .mockResolvedValue({ kind: 'loaded', products: [product, secondProduct] }),
    };
    const view = await render(
      <MobileCustomerAppShell categoryPort={categories} productPort={products} />,
    );

    expect(await view.findByText('Шашлык из backend')).toBeOnTheScreen();
    expect(view.getByText('Крылья backend')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: '🥩 Шашлык' }));
    expect(view.queryByText('Крылья backend')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: '🍗 Крылья' }));
    expect(await view.findByText('Крылья backend')).toBeOnTheScreen();
    expect(view.queryByText('Шашлык из backend')).toBeNull();
  });

  it('filters the loaded catalog locally, intersects search with category and clears the query', async () => {
    const secondCategoryId = 'a6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
    const searchedProduct = {
      ...product,
      description: 'Маринованный перец на углях',
      name: 'Мясо на углях',
    };
    const secondProduct = {
      ...product,
      categoryId: secondCategoryId,
      id: 'c7f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
      name: 'Овощи гриль',
    };
    const listCategories = jest.fn<
      ReturnType<CategoryListPort['listCategories']>,
      Parameters<CategoryListPort['listCategories']>
    >();
    listCategories.mockResolvedValue({
      kind: 'loaded',
      categories: [
        { id: categoryId, name: 'Шашлык' },
        { id: secondCategoryId, name: 'Овощи' },
      ],
    });
    const listProducts = jest.fn<
      ReturnType<ProductListPort['listProducts']>,
      Parameters<ProductListPort['listProducts']>
    >();
    listProducts.mockResolvedValue({ kind: 'loaded', products: [searchedProduct, secondProduct] });
    const categories: CategoryListPort = { listCategories };
    const products: ProductListPort = { listProducts };
    const view = await render(
      <MobileCustomerAppShell categoryPort={categories} productPort={products} />,
    );

    expect(await view.findByText('Мясо на углях')).toBeOnTheScreen();
    expect(view.getByTestId('catalog-search-input')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Очистить поиск' })).toBeOnTheScreen();
    const categoryCalls = listCategories.mock.calls.length;
    const productCalls = listProducts.mock.calls.length;

    await fireEvent.changeText(view.getByTestId('catalog-search-input'), '  ПЕРЕЦ  ');
    expect(view.getByText('Мясо на углях')).toBeOnTheScreen();
    expect(view.queryByText('Овощи гриль')).toBeNull();
    expect(listCategories).toHaveBeenCalledTimes(categoryCalls);
    expect(listProducts).toHaveBeenCalledTimes(productCalls);

    await fireEvent.press(view.getByRole('button', { name: 'Очистить поиск' }));
    expect(view.getByText('Мясо на углях')).toBeOnTheScreen();
    expect(view.getByText('Овощи гриль')).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('catalog-search-input'), 'овощи');
    await fireEvent.press(view.getByRole('button', { name: '🥩 Шашлык' }));
    expect(view.getByTestId('product-search-empty-state')).toBeOnTheScreen();
    expect(view.getByText('Ничего не найдено.')).toBeOnTheScreen();
    expect(listCategories).toHaveBeenCalledTimes(categoryCalls);
    expect(listProducts).toHaveBeenCalledTimes(productCalls);

    await fireEvent.press(view.getByRole('button', { name: 'Очистить поиск' }));
    expect(view.getByText('Мясо на углях')).toBeOnTheScreen();
    expect(view.queryByText('Овощи гриль')).toBeNull();
  });

  it('distinguishes an empty catalog from a search with no matches', async () => {
    const emptyView = await render(
      <MobileCustomerAppShell
        categoryPort={categoryPort}
        productPort={{
          listProducts: jest.fn().mockResolvedValue({ kind: 'loaded', products: [] }),
        }}
      />,
    );

    expect(await emptyView.findByTestId('product-empty-state')).toBeOnTheScreen();
    expect(emptyView.getByText('В меню пока нет блюд.')).toBeOnTheScreen();
    expect(emptyView.queryByTestId('product-search-empty-state')).toBeNull();
  });

  it('keeps catalog failure visible and retries the authoritative ports', async () => {
    const listCategories = jest.fn<
      ReturnType<CategoryListPort['listCategories']>,
      Parameters<CategoryListPort['listCategories']>
    >();
    listCategories.mockResolvedValue({
      kind: 'loaded',
      categories: [{ id: categoryId, name: 'Шашлык' }],
    });
    const listProducts = jest.fn<
      ReturnType<ProductListPort['listProducts']>,
      Parameters<ProductListPort['listProducts']>
    >();
    listProducts
      .mockResolvedValueOnce({ kind: 'failure', reason: 'network' })
      .mockResolvedValue({ kind: 'loaded', products: [product] });

    const view = await render(
      <MobileCustomerAppShell categoryPort={{ listCategories }} productPort={{ listProducts }} />,
    );

    expect(await view.findByTestId('product-error-state')).toBeOnTheScreen();
    expect(view.getByText('Блюда: backend сейчас недоступен.')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Повторить' }));
    expect(await view.findByText('Шашлык из backend')).toBeOnTheScreen();
    expect(listCategories).toHaveBeenCalledTimes(2);
    expect(listProducts).toHaveBeenCalledTimes(2);
  });
});

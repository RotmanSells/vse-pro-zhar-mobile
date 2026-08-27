jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

import { fireEvent, render } from '@testing-library/react-native';

import type { ProductDetailsPort } from '../src/application/catalog/product.ts';
import { MobileProductDetailsShell } from '../src/presentation/catalog/product-details-shell.tsx';

const productId = 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047';
const details = {
  adminEnabled: true,
  basePriceMinor: 45_050,
  categoryId: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  categoryName: 'Шашлык',
  description: 'Сочный шашлык и специи',
  id: productId,
  isHit: true,
  isNew: true,
  name: 'Шашлык из backend',
  weightGrams: 350,
};

describe('Mobile Product details shell', () => {
  it('shows Backend-confirmed details', async () => {
    const getProduct = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'loaded', product: details })
      .mockResolvedValueOnce({ kind: 'failure', reason: 'not_found' });
    const port: ProductDetailsPort = { getProduct };
    const view = await render(
      <MobileProductDetailsShell productId={productId} productPort={port} />,
    );
    expect(await view.findByText('Шашлык из backend')).toBeOnTheScreen();
    expect(view.getByText('Сочный шашлык и специи')).toBeOnTheScreen();
    expect(view.getByText('350 г')).toBeOnTheScreen();
    expect(view.getByText('Шашлык')).toBeOnTheScreen();
    expect(view.getByText('450,50 ₽')).toBeOnTheScreen();
    expect(view.getByText('Новинка')).toBeOnTheScreen();
    expect(view.getByText('Хит')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('← Меню'));
  });

  it('shows a safe not-found state with retry', async () => {
    const port: ProductDetailsPort = {
      getProduct: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'not_found' }),
    };
    const view = await render(
      <MobileProductDetailsShell productId={productId} productPort={port} />,
    );
    expect(
      await view.findByText('Это блюдо недоступно или больше не существует.'),
    ).toBeOnTheScreen();
    expect(view.getByText('Повторить')).toBeOnTheScreen();
  });

  it('shows a safe failed request with retry', async () => {
    const port: ProductDetailsPort = {
      getProduct: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
    };
    const view = await render(
      <MobileProductDetailsShell productId={productId} productPort={port} />,
    );
    expect(await view.findByText('Блюдо: backend сейчас недоступен.')).toBeOnTheScreen();
    expect(view.getByText('Повторить')).toBeOnTheScreen();
  });
});

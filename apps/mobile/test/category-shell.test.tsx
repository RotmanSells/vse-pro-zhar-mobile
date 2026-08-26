import { fireEvent, render } from '@testing-library/react-native';

import type { CategoryListPort } from '../src/application/catalog/category.ts';
import { MobileCatalogShell } from '../src/presentation/catalog/catalog-shell.tsx';

describe('Mobile Category shell', () => {
  it('shows loading, Backend data and a safe retry state', async () => {
    let shouldFail = true;
    let resolveFirst:
      ((value: { readonly kind: 'failure'; readonly reason: 'network' }) => void) | undefined;
    const firstLoad = new Promise<{
      readonly kind: 'failure';
      readonly reason: 'network';
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const categoryPort: CategoryListPort = {
      listCategories: jest
        .fn()
        .mockImplementationOnce(() => firstLoad)
        .mockImplementation(() =>
          Promise.resolve(
            shouldFail
              ? { kind: 'failure', reason: 'network' }
              : {
                  kind: 'loaded',
                  categories: [{ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }],
                },
          ),
        ),
    };
    const view = await render(<MobileCatalogShell categoryPort={categoryPort} />);

    expect(view.getByText('Загружаем категории…')).toBeOnTheScreen();
    resolveFirst?.({ kind: 'failure', reason: 'network' });
    expect(await view.findByText('Категории: backend сейчас недоступен.')).toBeOnTheScreen();
    shouldFail = false;
    await fireEvent.press(view.getByText('Повторить'));
    expect(await view.findByText('Супы')).toBeOnTheScreen();
    const category = view.getByRole('button', { name: 'Супы' });
    expect(category.props.accessibilityState).toEqual({ selected: true });
    expect(category.props.accessibilityRole).toBe('button');
  });
});

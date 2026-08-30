import { renderToStaticMarkup } from 'react-dom/server';

import { ProductCreateForm } from '../app/menu/product-create-form';
import { ProductDetailsForm } from '../app/menu/product-details-form';

const category = {
  id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
  name: 'Шашлык',
};

describe('Admin Product form', () => {
  it('renders Category choice, price and explicit enabled/disabled controls', () => {
    const markup = renderToStaticMarkup(
      <ProductCreateForm
        categories={[category]}
        createProduct={() => Promise.resolve({ kind: 'failure', reason: 'network' })}
      />,
    );

    expect(markup).toContain('aria-label="Создать товар"');
    expect(markup).toContain('id="product-category"');
    expect(markup).toContain('id="product-name"');
    expect(markup).toContain('id="product-price"');
    expect(markup).toContain('id="product-image"');
    expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(markup).toContain('name="adminEnabled"');
    expect(markup).toContain('Показывать в каталоге');
    expect(markup).toContain('Скрыть из каталога');
    expect(markup).toContain('Создать товар');
  });

  it('renders only the approved editable Product details', () => {
    const markup = renderToStaticMarkup(
      <ProductDetailsForm
        categoryName="Шашлык"
        product={{
          adminEnabled: true,
          basePriceMinor: 45_000,
          categoryId: category.id,
          description: null,
          id: 'd6f6d7cc-e4c1-4ac4-a7e4-61ae5f290047',
          isHit: false,
          isNew: false,
          name: 'Шашлык',
          weightGrams: null,
        }}
        updateProductDetails={() => Promise.resolve({ kind: 'failure', reason: 'network' })}
        updateProductVisibility={() => Promise.resolve({ kind: 'failure', reason: 'network' })}
      />,
    );
    expect(markup).toContain('aria-label="Детали товара Шашлык"');
    expect(markup).toContain('Описание и состав');
    expect(markup).toContain('Вес, г');
    expect(markup).toContain('Новинка');
    expect(markup).toContain('Хит');
    expect(markup).toContain('Видимость в каталоге');
    expect(markup).toContain('Показывать в каталоге');
    expect(markup).toContain('Скрыть из каталога');
    expect(markup).toContain('Сохранить видимость');
    expect(markup).not.toContain('name="basePriceRub"');
    expect(markup).not.toContain('name="categoryId"');
  });
});

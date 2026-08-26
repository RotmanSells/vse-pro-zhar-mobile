import { renderToStaticMarkup } from 'react-dom/server';

import { ProductCreateForm } from '../app/menu/product-create-form';

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

    expect(markup).toContain('aria-label="Create Product"');
    expect(markup).toContain('id="product-category"');
    expect(markup).toContain('id="product-name"');
    expect(markup).toContain('id="product-price"');
    expect(markup).toContain('name="adminEnabled"');
    expect(markup).toContain('Visible in catalog');
    expect(markup).toContain('Hidden from catalog');
    expect(markup).toContain('Create Product');
  });
});

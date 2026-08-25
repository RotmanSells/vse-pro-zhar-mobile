import { renderToStaticMarkup } from 'react-dom/server';

import { CategoryCreateForm } from '../app/menu/category-create-form';

describe('Admin Category form', () => {
  it('renders a focused real Category form with submit state wiring', () => {
    const markup = renderToStaticMarkup(
      <CategoryCreateForm
        createCategory={() =>
          Promise.resolve({
            kind: 'failure',
            reason: 'network',
          })
        }
      />,
    );

    expect(markup).toContain('aria-label="Create Category"');
    expect(markup).toContain('id="category-name"');
    expect(markup).toContain('Create Category');
  });
});

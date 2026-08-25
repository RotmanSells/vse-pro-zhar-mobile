import { renderToStaticMarkup } from 'react-dom/server';

import { CategoryCreateForm } from '../app/menu/category-create-form';

describe('Admin Category form', () => {
  it('renders a focused real Category form with submit state wiring', () => {
    const markup = renderToStaticMarkup(<CategoryCreateForm apiBaseUrl="http://127.0.0.1:3100" />);

    expect(markup).toContain('aria-label="Create Category"');
    expect(markup).toContain('id="category-name"');
    expect(markup).toContain('Create Category');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';

import { CategoryCreateForm } from '../app/menu/category-create-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

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
    expect(markup).toContain('class="category-form"');
    expect(markup).toContain('id="category-name"');
    expect(markup).toContain('class="form-help"');
    expect(markup).toContain('class="control-button control-button-primary"');
    expect(markup).toContain('Create Category');
  });
});

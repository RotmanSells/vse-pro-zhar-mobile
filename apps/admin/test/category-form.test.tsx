import { renderToStaticMarkup } from 'react-dom/server';

import { CategoryCreateForm, submitCategoryFormAndRefresh } from '../app/menu/category-create-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

describe('Admin Category form', () => {
  it('refreshes the server-rendered Product categories once after successful creation', async () => {
    const router = { refresh: jest.fn() };
    const createCategory = jest.fn().mockResolvedValue({
      kind: 'created',
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
    });

    await expect(
      submitCategoryFormAndRefresh('Супы', createCategory, () => router.refresh()),
    ).resolves.toMatchObject({ kind: 'created' });
    expect(router.refresh).toHaveBeenCalledTimes(1);

    const failedRouter = { refresh: jest.fn() };
    const failedCreateCategory = jest
      .fn()
      .mockResolvedValue({ kind: 'failure', reason: 'network' });
    await expect(
      submitCategoryFormAndRefresh('Супы', failedCreateCategory, () => failedRouter.refresh()),
    ).resolves.toEqual({ kind: 'failure', reason: 'network' });
    expect(failedRouter.refresh).not.toHaveBeenCalled();
  });

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

    expect(markup).toContain('aria-label="Создать категорию"');
    expect(markup).toContain('class="category-form"');
    expect(markup).toContain('id="category-name"');
    expect(markup).toContain('class="form-help"');
    expect(markup).toContain('class="control-button control-button-primary"');
    expect(markup).toContain('Создать категорию');
  });
});

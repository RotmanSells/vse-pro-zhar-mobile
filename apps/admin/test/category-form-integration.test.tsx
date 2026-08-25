import { submitCategoryForm } from '../app/menu/category-create-form';

describe('Admin Category form/client integration', () => {
  it('submits the Admin form value through the real Category API contract', async () => {
    const action = jest.fn().mockResolvedValue({
      kind: 'created',
      category: { id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' },
    });

    await expect(submitCategoryForm('  Супы  ', action)).resolves.toEqual({
      kind: 'created',
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
    });
    expect(action).toHaveBeenCalledWith({ name: '  Супы  ' });
  });
});

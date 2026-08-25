import { submitCategory, type CreateCategoryPort } from '../src/application/catalog/category';

describe('Admin Category Application', () => {
  it('validates the form input and delegates a real Category create port', async () => {
    const createCategory = jest.fn().mockResolvedValue({
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
      kind: 'created',
    });
    const port: CreateCategoryPort = { createCategory };

    await expect(submitCategory({ name: '  Супы  ' }, port)).resolves.toEqual({
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
      kind: 'created',
    });
    expect(createCategory).toHaveBeenCalledWith({ name: 'Супы' });
  });

  it('rejects an empty name before calling the port', async () => {
    const createCategory = jest.fn();
    const port: CreateCategoryPort = { createCategory };

    await expect(submitCategory({ name: '   ' }, port)).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_request',
    });
    expect(createCategory).not.toHaveBeenCalled();
  });
});

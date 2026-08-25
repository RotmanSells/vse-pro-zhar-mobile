import { loadCategories, type CategoryListPort } from '../src/application/catalog/category.ts';

describe('Mobile Category Application', () => {
  it('keeps the Backend-confirmed Category list', async () => {
    const port: CategoryListPort = {
      listCategories: jest.fn().mockResolvedValue({
        kind: 'loaded',
        categories: [{ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }],
      }),
    };

    await expect(loadCategories(port)).resolves.toEqual({
      kind: 'loaded',
      categories: [{ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }],
    });
  });

  it('converts an unexpected port rejection into a safe network state', async () => {
    const port: CategoryListPort = {
      listCategories: jest.fn().mockRejectedValue(new Error('network detail')),
    };

    await expect(loadCategories(port)).resolves.toEqual({ kind: 'failure', reason: 'network' });
  });
});

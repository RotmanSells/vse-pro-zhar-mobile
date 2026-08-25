import { createCategoryApiClient } from '../src/infrastructure/catalog/category-api-client';
import { submitCategoryForm } from '../app/menu/category-create-form';

describe('Admin Category form/client integration', () => {
  it('submits the Admin form value through the real Category API contract', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047', name: 'Супы' }), {
        status: 201,
      }),
    );
    const client = createCategoryApiClient({
      apiBaseUrl: 'http://127.0.0.1:3100',
      fetchImpl,
    });

    await expect(submitCategoryForm('  Супы  ', client)).resolves.toEqual({
      kind: 'created',
      category: {
        id: 'f9b7d7cc-e4c1-4ac4-a7e4-61ae5f290047',
        name: 'Супы',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

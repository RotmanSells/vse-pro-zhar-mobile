'use server';

import { createCategory } from '../../src/main';
import type { CreateCategoryResult } from '../../src/application/catalog/category';

export async function createCategoryAction(input: {
  readonly name: string;
}): Promise<CreateCategoryResult> {
  return createCategory(input);
}

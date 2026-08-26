'use server';

import { createCategory, listCategories } from '../../src/main';
import type {
  CreateCategoryResult,
  ListCategoriesResult,
} from '../../src/application/catalog/category';

export async function createCategoryAction(input: {
  readonly name: string;
}): Promise<CreateCategoryResult> {
  return createCategory(input);
}

export async function listCategoriesAction(): Promise<ListCategoriesResult> {
  return listCategories();
}

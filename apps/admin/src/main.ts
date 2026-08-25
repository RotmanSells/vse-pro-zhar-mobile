import { submitCategory, type CreateCategoryResult } from './application/catalog/category';
import {
  createCategoryApiClient,
  type CreateCategoryApiClientOptions,
} from './infrastructure/catalog/category-api-client';

export type AdminCategoryOperation = (input: {
  readonly name: string;
}) => Promise<CreateCategoryResult>;

export function createAdminCategoryOperation(
  options: CreateCategoryApiClientOptions = {},
): AdminCategoryOperation {
  const categoryPort = createCategoryApiClient(options);
  return (input) => submitCategory(input, categoryPort);
}

export function createCategory(input: { readonly name: string }): Promise<CreateCategoryResult> {
  return createAdminCategoryOperation()(input);
}

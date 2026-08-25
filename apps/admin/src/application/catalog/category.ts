import {
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
  type CategoryResponse,
} from '../../../../../packages/contracts/src/category';

export type AdminCategoryFailureReason =
  | 'configuration'
  | 'forbidden'
  | 'http'
  | 'invalid_request'
  | 'invalid_response'
  | 'network'
  | 'timeout'
  | 'unauthorized';

export type CreateCategoryResult =
  | { readonly kind: 'created'; readonly category: CategoryResponse }
  | { readonly kind: 'failure'; readonly reason: AdminCategoryFailureReason };

export interface CreateCategoryPort {
  createCategory(input: { readonly name: string }): Promise<CreateCategoryResult>;
}

export async function submitCategory(
  input: { readonly name: string },
  port: CreateCategoryPort,
): Promise<CreateCategoryResult> {
  const parsedInput = CreateCategoryRequestSchema.safeParse(input);
  if (!parsedInput.success) return { kind: 'failure', reason: 'invalid_request' };

  try {
    const result = await port.createCategory(parsedInput.data);
    if (result.kind === 'failure') return result;
    const parsedCategory = CategoryResponseSchema.safeParse(result.category);
    return parsedCategory.success
      ? { kind: 'created', category: parsedCategory.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

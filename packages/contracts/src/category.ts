import { z } from 'zod';

const CategoryNameSchema = z.string().trim().min(1).max(200);

export const CategoryResponseSchema = z
  .object({
    id: z.uuid(),
    name: CategoryNameSchema,
  })
  .strict();

export const CreateCategoryRequestSchema = z
  .object({
    name: CategoryNameSchema,
  })
  .strict();

export const CategoryListResponseSchema = z.array(CategoryResponseSchema);

export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequestSchema>;
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

export function parseCategoryResponse(payload: unknown): CategoryResponse {
  return CategoryResponseSchema.parse(payload);
}

export function parseCategoryListResponse(payload: unknown): CategoryListResponse {
  return CategoryListResponseSchema.parse(payload);
}

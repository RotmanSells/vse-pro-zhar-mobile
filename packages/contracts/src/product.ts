import { z } from 'zod';

export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_BASE_PRICE_MINOR_MAX = 2_147_483_647;

const ProductNameSchema = z.string().trim().min(1).max(PRODUCT_NAME_MAX_LENGTH);
const ProductBasePriceMinorSchema = z.number().int().positive().max(PRODUCT_BASE_PRICE_MINOR_MAX);

export const ProductResponseSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    name: ProductNameSchema,
    basePriceMinor: ProductBasePriceMinorSchema,
    adminEnabled: z.boolean(),
  })
  .strict();

export const CreateProductRequestSchema = z
  .object({
    categoryId: z.uuid(),
    name: ProductNameSchema,
    basePriceMinor: ProductBasePriceMinorSchema,
    adminEnabled: z.boolean(),
  })
  .strict();

export const ProductListResponseSchema = z.array(ProductResponseSchema);

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

export function parseProductResponse(payload: unknown): ProductResponse {
  return ProductResponseSchema.parse(payload);
}

export function parseProductListResponse(payload: unknown): ProductListResponse {
  return ProductListResponseSchema.parse(payload);
}

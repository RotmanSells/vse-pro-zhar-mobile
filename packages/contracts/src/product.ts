import { z } from 'zod';

export const PRODUCT_NAME_MAX_LENGTH = 200;
export const PRODUCT_BASE_PRICE_MINOR_MAX = 2_147_483_647;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
export const PRODUCT_WEIGHT_GRAMS_MAX = 2_147_483_647;

const ProductNameSchema = z.string().trim().min(1).max(PRODUCT_NAME_MAX_LENGTH);
const ProductBasePriceMinorSchema = z.number().int().positive().max(PRODUCT_BASE_PRICE_MINOR_MAX);
const ProductDescriptionSchema = z.string().trim().max(PRODUCT_DESCRIPTION_MAX_LENGTH).nullable();
const ProductWeightGramsSchema = z
  .number()
  .int()
  .positive()
  .max(PRODUCT_WEIGHT_GRAMS_MAX)
  .nullable();

export const ProductResponseSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    name: ProductNameSchema,
    basePriceMinor: ProductBasePriceMinorSchema,
    adminEnabled: z.boolean(),
    description: ProductDescriptionSchema,
    weightGrams: ProductWeightGramsSchema,
    isNew: z.boolean(),
    isHit: z.boolean(),
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

export const UpdateProductDetailsRequestSchema = z
  .object({
    description: ProductDescriptionSchema,
    weightGrams: ProductWeightGramsSchema,
    isNew: z.boolean(),
    isHit: z.boolean(),
  })
  .strict();

export const ProductDetailsResponseSchema = ProductResponseSchema.extend({
  categoryName: z.string().trim().min(1).max(200),
}).strict();

export const ProductListResponseSchema = z.array(ProductResponseSchema);

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;
export type UpdateProductDetailsRequest = z.infer<typeof UpdateProductDetailsRequestSchema>;
export type ProductDetailsResponse = z.infer<typeof ProductDetailsResponseSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

export function parseProductResponse(payload: unknown): ProductResponse {
  return ProductResponseSchema.parse(payload);
}

export function parseProductListResponse(payload: unknown): ProductListResponse {
  return ProductListResponseSchema.parse(payload);
}

export function parseProductDetailsResponse(payload: unknown): ProductDetailsResponse {
  return ProductDetailsResponseSchema.parse(payload);
}

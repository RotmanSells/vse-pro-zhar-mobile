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

export const UpdateProductVisibilityRequestSchema = z
  .object({
    adminEnabled: z.boolean(),
  })
  .strict();

export const ProductDetailsResponseSchema = ProductResponseSchema.extend({
  categoryName: z.string().trim().min(1).max(200),
}).strict();

export const ProductListResponseSchema = z.array(ProductResponseSchema);
export const ProductImageUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
}, 'Product image URL must use HTTP(S)');
export const ProductWithImageResponseSchema = ProductResponseSchema.extend({
  imageUrl: ProductImageUrlSchema,
}).strict();
export const ProductDetailsWithImageResponseSchema = ProductDetailsResponseSchema.extend({
  imageUrl: ProductImageUrlSchema,
}).strict();
export const ProductWithImageListResponseSchema = z.array(ProductWithImageResponseSchema);

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;
export type UpdateProductDetailsRequest = z.infer<typeof UpdateProductDetailsRequestSchema>;
export type UpdateProductVisibilityRequest = z.infer<typeof UpdateProductVisibilityRequestSchema>;
export type ProductDetailsResponse = z.infer<typeof ProductDetailsResponseSchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
export type ProductWithImageResponse = z.infer<typeof ProductWithImageResponseSchema>;
export type ProductDetailsWithImageResponse = z.infer<typeof ProductDetailsWithImageResponseSchema>;
export type ProductWithImageListResponse = z.infer<typeof ProductWithImageListResponseSchema>;

export function parseProductResponse(payload: unknown): ProductResponse {
  return ProductResponseSchema.parse(payload);
}

export function parseProductListResponse(payload: unknown): ProductListResponse {
  return ProductListResponseSchema.parse(payload);
}

export function parseProductDetailsResponse(payload: unknown): ProductDetailsResponse {
  return ProductDetailsResponseSchema.parse(payload);
}

export function parseProductWithImageResponse(payload: unknown): ProductWithImageResponse {
  return ProductWithImageResponseSchema.parse(payload);
}

export function parseProductDetailsWithImageResponse(
  payload: unknown,
): ProductDetailsWithImageResponse {
  return ProductDetailsWithImageResponseSchema.parse(payload);
}

export function parseProductWithImageListResponse(payload: unknown): ProductWithImageListResponse {
  return ProductWithImageListResponseSchema.parse(payload);
}

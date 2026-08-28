import {
  CreateProductRequestSchema,
  PRODUCT_BASE_PRICE_MINOR_MAX,
  ProductListResponseSchema,
  ProductResponseSchema,
  ProductWithImageResponseSchema,
  UpdateProductDetailsRequestSchema,
  UpdateProductVisibilityRequestSchema,
  type ProductResponse,
} from '../../../../../packages/contracts/src/product';

export type AdminProductFailureReason =
  | 'conflict'
  | 'configuration'
  | 'forbidden'
  | 'http'
  | 'invalid_request'
  | 'invalid_response'
  | 'network'
  | 'not_found'
  | 'payload_too_large'
  | 'invalid_image'
  | 'storage'
  | 'timeout'
  | 'unauthorized';

export type CreateProductResult =
  | { readonly kind: 'created'; readonly product: ProductResponse }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };
export type LoadProductsResult =
  | { readonly kind: 'loaded'; readonly products: readonly ProductResponse[] }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };
export type UpdateProductDetailsResult =
  | { readonly kind: 'updated'; readonly product: ProductResponse }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };
export type UpdateProductImageResult =
  | { readonly kind: 'updated'; readonly product: ProductResponse }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };
export type UpdateProductVisibilityResult =
  | { readonly kind: 'updated'; readonly product: ProductResponse }
  | { readonly kind: 'failure'; readonly reason: AdminProductFailureReason };

export interface CreateProductPort {
  createProduct(input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
    readonly image?: Blob;
  }): Promise<CreateProductResult>;
}
export interface ProductCatalogPort extends CreateProductPort {
  listProducts(): Promise<LoadProductsResult>;
  updateProductDetails(input: {
    readonly id: string;
    readonly description: string | null;
    readonly weightGrams: number | null;
    readonly isNew: boolean;
    readonly isHit: boolean;
  }): Promise<UpdateProductDetailsResult>;
  updateProductVisibility(input: {
    readonly id: string;
    readonly adminEnabled: boolean;
  }): Promise<UpdateProductVisibilityResult>;
  replaceProductImage(input: {
    readonly id: string;
    readonly image: Blob;
  }): Promise<UpdateProductImageResult>;
}

const RUB_PRICE_PATTERN = /^(?:0|[1-9][0-9]*)(?:[.,][0-9]{1,2})?$/u;

export function parseRubPriceToMinorUnits(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!RUB_PRICE_PATTERN.test(normalized)) return undefined;

  const [wholePart = '0', fractionPart = ''] = normalized.split('.');
  const minorUnits = BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, '0') || '0');
  const maximum = BigInt(PRODUCT_BASE_PRICE_MINOR_MAX);
  if (minorUnits < 1n || minorUnits > maximum) return undefined;
  return Number(minorUnits);
}

export async function submitProduct(
  input: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceRub: string;
    readonly adminEnabled: boolean;
    readonly image?: Blob;
  },
  port: CreateProductPort,
): Promise<CreateProductResult> {
  const basePriceMinor = parseRubPriceToMinorUnits(input.basePriceRub);
  if (basePriceMinor === undefined) return { kind: 'failure', reason: 'invalid_request' };

  const parsedInput = CreateProductRequestSchema.safeParse({
    adminEnabled: input.adminEnabled,
    basePriceMinor,
    categoryId: input.categoryId,
    name: input.name,
  });
  if (!parsedInput.success) return { kind: 'failure', reason: 'invalid_request' };

  try {
    const result = await port.createProduct({
      ...parsedInput.data,
      ...(input.image === undefined ? {} : { image: input.image }),
    });
    if (result.kind === 'failure') return result;
    const parsedImageProduct = ProductWithImageResponseSchema.safeParse(result.product);
    if (parsedImageProduct.success) return { kind: 'created', product: parsedImageProduct.data };
    const parsedProduct = ProductResponseSchema.safeParse(result.product);
    return parsedProduct.success
      ? { kind: 'created', product: parsedProduct.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

export async function submitProductImage(
  input: { readonly id: string; readonly image?: Blob },
  port: Pick<ProductCatalogPort, 'replaceProductImage'>,
): Promise<UpdateProductImageResult> {
  if (!ProductResponseSchema.shape.id.safeParse(input.id).success || input.image === undefined) {
    return { kind: 'failure', reason: 'invalid_request' };
  }
  try {
    const result = await port.replaceProductImage({ id: input.id, image: input.image });
    if (result.kind === 'failure') return result;
    const parsedImageProduct = ProductWithImageResponseSchema.safeParse(result.product);
    return parsedImageProduct.success
      ? { kind: 'updated', product: parsedImageProduct.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

export async function loadProducts(
  port: Pick<ProductCatalogPort, 'listProducts'>,
): Promise<LoadProductsResult> {
  try {
    const result = await port.listProducts();
    if (result.kind === 'failure') return result;
    const parsedProducts = ProductListResponseSchema.safeParse(result.products);
    return parsedProducts.success
      ? { kind: 'loaded', products: parsedProducts.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

export function parseWeightGrams(value: string): number | null | undefined {
  const normalized = value.trim();
  if (normalized === '') return null;
  if (!/^[1-9][0-9]*$/u.test(normalized)) return undefined;
  const weight = Number(normalized);
  return Number.isSafeInteger(weight) && weight > 0 ? weight : undefined;
}

export async function submitProductDetails(
  input: {
    readonly id: string;
    readonly description: string;
    readonly weightGrams: string;
    readonly isNew: boolean;
    readonly isHit: boolean;
  },
  port: Pick<ProductCatalogPort, 'updateProductDetails'>,
): Promise<UpdateProductDetailsResult> {
  if (!ProductResponseSchema.shape.id.safeParse(input.id).success) {
    return { kind: 'failure', reason: 'invalid_request' };
  }
  const weightGrams = parseWeightGrams(input.weightGrams);
  const parsedInput = UpdateProductDetailsRequestSchema.safeParse({
    description: input.description.trim() === '' ? null : input.description,
    isHit: input.isHit,
    isNew: input.isNew,
    weightGrams,
  });
  if (!parsedInput.success) return { kind: 'failure', reason: 'invalid_request' };
  try {
    const result = await port.updateProductDetails({ id: input.id, ...parsedInput.data });
    if (result.kind === 'failure') return result;
    const parsedProduct = ProductResponseSchema.safeParse(result.product);
    return parsedProduct.success
      ? { kind: 'updated', product: parsedProduct.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

export async function submitProductVisibility(
  input: { readonly id: string; readonly adminEnabled: boolean },
  port: Pick<ProductCatalogPort, 'updateProductVisibility'>,
): Promise<UpdateProductVisibilityResult> {
  if (!ProductResponseSchema.shape.id.safeParse(input.id).success) {
    return { kind: 'failure', reason: 'invalid_request' };
  }
  const parsedInput = UpdateProductVisibilityRequestSchema.safeParse({
    adminEnabled: input.adminEnabled,
  });
  if (!parsedInput.success) return { kind: 'failure', reason: 'invalid_request' };
  try {
    const result = await port.updateProductVisibility({ id: input.id, ...parsedInput.data });
    if (result.kind === 'failure') return result;
    const parsedProduct = ProductResponseSchema.safeParse(result.product);
    return parsedProduct.success
      ? { kind: 'updated', product: parsedProduct.data }
      : { kind: 'failure', reason: 'invalid_response' };
  } catch {
    return { kind: 'failure', reason: 'network' };
  }
}

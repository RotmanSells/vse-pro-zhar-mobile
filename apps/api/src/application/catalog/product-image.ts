import type { AdminPrincipal } from '../admin-authorization.ts';
import {
  assertCanCreateProductImage,
  assertCanUpdateProductImage,
  PRODUCT_IMAGE_CREATE_OPERATION,
  PRODUCT_IMAGE_UPDATE_OPERATION,
  ProductImageCreateAuthorizationError,
  ProductImageUpdateAuthorizationError,
} from '../admin-authorization.ts';
import {
  createProduct as createDomainProduct,
  normalizeProductBasePriceMinor,
  normalizeProductCategoryId,
  normalizeProductId,
  normalizeProductName,
  type Product,
  ProductIdValidationError,
} from '../../domain/catalog/product.ts';
import type { ProductCategoryReferenceRepository, ProductRepository } from './product.ts';
import { ProductCategoryNotFoundError } from './product.ts';

export {
  PRODUCT_IMAGE_CREATE_OPERATION,
  PRODUCT_IMAGE_UPDATE_OPERATION,
  ProductImageCreateAuthorizationError,
  ProductImageUpdateAuthorizationError,
};

export const PRODUCT_IMAGE_OBJECT_PREFIX = 'product-images';
export const PRODUCT_IMAGE_CONTENT_TYPE = 'image/webp';

export interface ProcessedProductImage {
  readonly data: Uint8Array;
  readonly contentType: typeof PRODUCT_IMAGE_CONTENT_TYPE;
}

export interface ProductImageProcessor {
  process(input: Uint8Array): Promise<ProcessedProductImage>;
}

export type StoredObject = Uint8Array | AsyncIterable<Uint8Array>;

export interface ObjectStorage {
  put(input: {
    readonly key: string;
    readonly body: Uint8Array;
    readonly contentType: typeof PRODUCT_IMAGE_CONTENT_TYPE;
  }): Promise<void>;
  get(input: { readonly key: string }): Promise<StoredObject>;
  delete(input: { readonly key: string }): Promise<void>;
}

export interface ImageMutationReservation {
  readonly release: () => void;
}

export interface ImageMutationGuard {
  reserve(principal: AdminPrincipal): ImageMutationReservation | undefined;
}

export class ProductImageNotFoundError extends Error {
  constructor() {
    super('Product image was not found');
    this.name = 'ProductImageNotFoundError';
  }
}
export class ProductImageConflictError extends Error {
  constructor() {
    super('Product image replacement conflicted with another update');
    this.name = 'ProductImageConflictError';
  }
}
export class ProductImageMissingError extends Error {
  constructor() {
    super('Product has no confirmed image');
    this.name = 'ProductImageMissingError';
  }
}
export class ProductImageRateLimitError extends Error {
  constructor() {
    super('Product image mutation rate limit exceeded');
    this.name = 'ProductImageRateLimitError';
  }
}
export class ProductImageStorageError extends Error {
  constructor() {
    super('Product image storage is unavailable');
    this.name = 'ProductImageStorageError';
  }
}
export class ProductImageProcessingError extends Error {
  constructor() {
    super('Product image processing failed');
    this.name = 'ProductImageProcessingError';
  }
}

export function buildProductImageObjectKey(productId: string, imageRevision: string): string {
  return `${PRODUCT_IMAGE_OBJECT_PREFIX}/${normalizeProductId(productId, 'id')}/${normalizeProductId(imageRevision, 'id')}.webp`;
}

export function buildProductImageUrl(
  publicApiBaseUrl: string,
  productId: string,
  imageRevision: string,
): string {
  const base = new URL(publicApiBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Public API base URL must be an HTTP(S) origin without credentials');
  }
  if (base.pathname !== '/' || base.search !== '' || base.hash !== '') {
    throw new Error('Public API base URL must not contain a path');
  }
  const id = normalizeProductId(productId, 'id');
  const revision = normalizeProductId(imageRevision, 'id');
  return new URL(`/products/${id}/image/${revision}`, base).toString();
}

export function toProductWithImage(
  product: Product,
  publicApiBaseUrl: string,
): Product & { readonly imageUrl: string; readonly imageRevision: string } {
  const imageRevision = product.imageRevision;
  if (typeof imageRevision !== 'string') throw new ProductImageMissingError();
  return {
    ...product,
    imageRevision,
    imageUrl: buildProductImageUrl(publicApiBaseUrl, product.id, imageRevision),
  };
}

function createProductId(idGenerator: () => string): string {
  return normalizeProductId(idGenerator(), 'id');
}

async function cleanupObject(storage: ObjectStorage, key: string): Promise<void> {
  try {
    await storage.delete({ key });
  } catch {
    console.error('product_image_cleanup_failed');
  }
}

async function processImage(
  processor: ProductImageProcessor,
  image: Uint8Array,
): Promise<ProcessedProductImage> {
  try {
    const processed = await processor.process(image);
    if (processed.contentType !== PRODUCT_IMAGE_CONTENT_TYPE) {
      throw new ProductImageProcessingError();
    }
    return processed;
  } catch {
    throw new ProductImageProcessingError();
  }
}

function requireImageRepository(
  repository: ProductRepository,
): Required<Pick<ProductRepository, 'findByIdForImage' | 'setImageRevisionIfCurrent'>> {
  if (
    repository.findByIdForImage === undefined ||
    repository.setImageRevisionIfCurrent === undefined
  ) {
    throw new Error('Product image repository operations are not configured');
  }
  return {
    findByIdForImage: repository.findByIdForImage.bind(repository),
    setImageRevisionIfCurrent: repository.setImageRevisionIfCurrent.bind(repository),
  };
}

export async function createProductWithImage(input: {
  readonly principal: AdminPrincipal;
  readonly product: {
    readonly categoryId: string;
    readonly name: string;
    readonly basePriceMinor: number;
    readonly adminEnabled: boolean;
  };
  readonly image: Uint8Array;
  readonly repository: ProductRepository;
  readonly categoryReferenceRepository: ProductCategoryReferenceRepository;
  readonly imageProcessor: ProductImageProcessor;
  readonly objectStorage: ObjectStorage;
  readonly productIdGenerator: () => string;
  readonly imageRevisionGenerator: () => string;
}): Promise<Product> {
  assertCanCreateProductImage(input.principal);
  const normalizedProduct = {
    adminEnabled: input.product.adminEnabled,
    basePriceMinor: normalizeProductBasePriceMinor(input.product.basePriceMinor),
    categoryId: normalizeProductCategoryId(input.product.categoryId),
    name: normalizeProductName(input.product.name),
  };
  if (!(await input.categoryReferenceRepository.exists(normalizedProduct.categoryId))) {
    throw new ProductCategoryNotFoundError();
  }

  const productId = createProductId(input.productIdGenerator);
  const imageRevision = createProductId(input.imageRevisionGenerator);
  const processed = await processImage(input.imageProcessor, input.image);
  const key = buildProductImageObjectKey(productId, imageRevision);
  try {
    try {
      await input.objectStorage.put({
        body: processed.data,
        contentType: PRODUCT_IMAGE_CONTENT_TYPE,
        key,
      });
    } catch (error) {
      throw error instanceof ProductImageStorageError ? error : new ProductImageStorageError();
    }
    try {
      return createDomainProduct(
        await input.repository.create({ ...normalizedProduct, id: productId, imageRevision }),
      );
    } catch (error) {
      await cleanupObject(input.objectStorage, key);
      throw error;
    }
  } catch (error) {
    if (error instanceof ProductImageStorageError) throw error;
    throw error;
  }
}

export async function replaceProductImage(input: {
  readonly principal: AdminPrincipal;
  readonly productId: string;
  readonly image: Uint8Array;
  readonly repository: ProductRepository;
  readonly imageProcessor: ProductImageProcessor;
  readonly objectStorage: ObjectStorage;
  readonly imageRevisionGenerator: () => string;
}): Promise<Product> {
  assertCanUpdateProductImage(input.principal);
  let productId: string;
  try {
    productId = normalizeProductId(input.productId, 'id');
  } catch (error) {
    if (error instanceof ProductIdValidationError) throw new ProductImageNotFoundError();
    throw error;
  }
  const imageRepository = requireImageRepository(input.repository);
  const current = await imageRepository.findByIdForImage(productId);
  if (current === undefined) throw new ProductImageNotFoundError();
  const oldRevision = current.imageRevision ?? null;
  const newRevision = normalizeProductId(input.imageRevisionGenerator(), 'id');
  const processed = await processImage(input.imageProcessor, input.image);
  const newKey = buildProductImageObjectKey(productId, newRevision);
  try {
    await input.objectStorage.put({
      body: processed.data,
      contentType: PRODUCT_IMAGE_CONTENT_TYPE,
      key: newKey,
    });
  } catch (error) {
    throw error instanceof ProductImageStorageError ? error : new ProductImageStorageError();
  }
  let updated: Product | undefined;
  try {
    updated = await imageRepository.setImageRevisionIfCurrent({
      expectedImageRevision: oldRevision,
      id: productId,
      imageRevision: newRevision,
    });
  } catch (error) {
    await cleanupObject(input.objectStorage, newKey);
    throw error;
  }
  if (updated === undefined) {
    await cleanupObject(input.objectStorage, newKey);
    throw new ProductImageConflictError();
  }
  if (oldRevision !== null) {
    await cleanupObject(input.objectStorage, buildProductImageObjectKey(productId, oldRevision));
  }
  return createDomainProduct(updated);
}

export async function loadVisibleProductImage(input: {
  readonly productId: string;
  readonly imageRevision: string;
  readonly repository: ProductRepository;
  readonly objectStorage: ObjectStorage;
}): Promise<{ readonly body: StoredObject; readonly etag: string }> {
  let productId: string;
  let imageRevision: string;
  try {
    productId = normalizeProductId(input.productId, 'id');
    imageRevision = normalizeProductId(input.imageRevision, 'id');
  } catch (error) {
    if (error instanceof ProductIdValidationError) throw new ProductImageNotFoundError();
    throw error;
  }
  const imageRepository = requireImageRepository(input.repository);
  const product = await imageRepository.findByIdForImage(productId);
  if (
    product === undefined ||
    product.adminEnabled !== true ||
    product.imageRevision !== imageRevision
  ) {
    throw new ProductImageNotFoundError();
  }
  try {
    const body = await input.objectStorage.get({
      key: buildProductImageObjectKey(productId, imageRevision),
    });
    return { body, etag: imageRevision };
  } catch {
    throw new ProductImageStorageError();
  }
}

export function createImageMutationGuard(
  options: {
    readonly now?: () => number;
    readonly maxMutations?: number;
    readonly windowMs?: number;
    readonly maxConcurrent?: number;
  } = {},
): ImageMutationGuard {
  const now = options.now ?? Date.now;
  const maxMutations = options.maxMutations ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const maxConcurrent = options.maxConcurrent ?? 2;
  const timestamps = new Map<string, number[]>();
  let active = 0;
  return {
    reserve(principal) {
      const currentTime = now();
      const recent = (timestamps.get(principal.subject) ?? []).filter(
        (timestamp) => currentTime - timestamp < windowMs,
      );
      if (recent.length >= maxMutations || active >= maxConcurrent) return undefined;
      timestamps.set(principal.subject, [...recent, currentTime]);
      active += 1;
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          active -= 1;
        },
      };
    },
  };
}

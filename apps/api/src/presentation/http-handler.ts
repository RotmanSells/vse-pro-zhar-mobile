import type { IncomingMessage, ServerResponse } from 'node:http';
import { Busboy, type BusboyFileStream } from '@fastify/busboy';

import {
  ApiErrorResponseSchema,
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
  CreateProductRequestSchema,
  ProductDetailsResponseSchema,
  CustomerProfilePatchRequestSchema,
  CustomerProfileResponseSchema,
  ProductListResponseSchema,
  ProductResponseSchema,
  ProductWithImageListResponseSchema,
  ProductWithImageResponseSchema,
  ProductDetailsWithImageResponseSchema,
  UpdateProductDetailsRequestSchema,
  UpdateProductVisibilityRequestSchema,
  LegalAcceptanceResponseSchema,
  RecordLegalAcceptanceRequestSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from '@vse-pro-zhar/contracts';

import {
  createCategory,
  listCategories,
  CategoryAuthorizationError,
  type CategoryRepository,
} from '../application/catalog/category.ts';
import {
  createProduct,
  getVisibleProductDetails,
  listAdminProducts,
  listProducts,
  updateProductDetails,
  updateProductVisibility,
  ProductAuthorizationError,
  ProductCategoryNotFoundError,
  ProductNotFoundError,
  ProductUpdateAuthorizationError,
  ProductVisibilityUpdateAuthorizationError,
  type ProductCategoryReferenceRepository,
  type ProductRepository,
} from '../application/catalog/product.ts';
import {
  createProductWithImage,
  loadVisibleProductImage,
  replaceProductImage,
  ProductImageConflictError,
  ProductImageCreateAuthorizationError,
  ProductImageMissingError,
  ProductImageNotFoundError,
  ProductImageProcessingError,
  ProductImageRateLimitError,
  ProductImageStorageError,
  ProductImageUpdateAuthorizationError,
  type ImageMutationGuard,
  type ObjectStorage,
  type ProductImageProcessor,
  type StoredObject,
  toProductWithImage,
} from '../application/catalog/product-image.ts';
import type { AdminIdentityResolver } from '../application/admin-authorization.ts';
import {
  getCurrentCustomerProfile,
  updateCurrentCustomerProfile,
  type CustomerProfileRepository,
  type CustomerProfileUpdate,
  type DevelopmentIdentityResolver,
} from '../application/customer-profile.ts';
import {
  getCurrentLegalAcceptances,
  recordCurrentLegalAcceptance,
  type LegalAcceptanceRepository,
} from '../application/legal-acceptance.ts';
import type { Product } from '../domain/catalog/product.ts';

import { buildHealthResponse } from './health-response.ts';

const HEALTH_PATH = '/health';
const ADMIN_CATEGORIES_PATH = '/admin/categories';
const CATEGORIES_PATH = '/categories';
const ADMIN_PRODUCTS_PATH = '/admin/products';
const PRODUCTS_PATH = '/products';
const ADMIN_PRODUCT_DETAILS_PATH = /^\/admin\/products\/([^/]+)\/details$/u;
const ADMIN_PRODUCT_VISIBILITY_PATH = /^\/admin\/products\/([^/]+)\/visibility$/u;
const PRODUCT_DETAILS_PATH = /^\/products\/([^/]+)$/u;
const V2_PRODUCTS_PATH = '/v2/products';
const V2_PRODUCT_DETAILS_PATH = /^\/v2\/products\/([^/]+)$/u;
const PRODUCT_IMAGE_PATH = /^\/products\/([^/]+)\/image\/([^/]+)$/u;
const V2_ADMIN_PRODUCTS_PATH = '/v2/admin/products';
const V2_ADMIN_PRODUCT_IMAGE_PATH = /^\/v2\/admin\/products\/([^/]+)\/image$/u;
const CUSTOMER_PROFILE_PATH = '/me/profile';
const LEGAL_ACCEPTANCES_PATH = '/me/legal-acceptances';
export const DEVELOPMENT_IDENTITY_HEADER = 'x-vpzh-development-identity';
export const DEVELOPMENT_ADMIN_IDENTITY_HEADER = 'x-vpzh-development-admin-identity';
const MAX_JSON_BODY_BYTES = 16_384;
const MAX_MULTIPART_BODY_BYTES = 10_551_296;
const MAX_MULTIPART_FILE_BYTES = 10_485_760;
const MAX_MULTIPART_FIELD_BYTES = 65_536;

const ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  FORBIDDEN: 'Forbidden',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_REQUEST: 'Invalid request',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  LEGACY_ENDPOINT_DISABLED: 'Legacy endpoint disabled',
  PAYLOAD_TOO_LARGE: 'Payload too large',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported media type',
  INVALID_IMAGE: 'Invalid image',
  STORAGE_UNAVAILABLE: 'Storage unavailable',
};

export interface RequestHandlerDependencies {
  readonly now: () => Date;
  readonly version: string;
  readonly identityResolver: DevelopmentIdentityResolver | undefined;
  readonly legalAcceptanceRepository: LegalAcceptanceRepository | undefined;
  readonly customerProfileRepository: CustomerProfileRepository | undefined;
  readonly categoryRepository: CategoryRepository | undefined;
  readonly adminIdentityResolver: AdminIdentityResolver | undefined;
  readonly productRepository: ProductRepository | undefined;
  readonly productCategoryReferenceRepository: ProductCategoryReferenceRepository | undefined;
  readonly imageProcessor: ProductImageProcessor | undefined;
  readonly objectStorage: ObjectStorage | undefined;
  readonly imageMutationGuard: ImageMutationGuard | undefined;
  readonly publicApiBaseUrl: string;
  readonly productImageWriteFrozen: boolean;
  readonly productIdGenerator: (() => string) | undefined;
  readonly imageRevisionGenerator: (() => string) | undefined;
}

function buildErrorResponse(code: ApiErrorCode): ApiErrorResponse {
  return ApiErrorResponseSchema.parse({
    error: {
      code,
      message: ERROR_MESSAGES[code],
    },
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

class InvalidJsonRequestError extends Error {}

class InvalidMultipartRequestError extends Error {}
class MultipartPayloadTooLargeError extends Error {}
class MultipartUnsupportedMediaTypeError extends Error {}

interface ProductMultipartFields {
  readonly categoryId?: string;
  readonly name?: string;
  readonly basePriceMinor?: string;
  readonly adminEnabled?: string;
  readonly image?: Uint8Array;
}

function discardRequest(request: IncomingMessage): void {
  request.resume();
}

function readMultipartBoundary(contentType: string | undefined): string | undefined {
  if (contentType === undefined) return undefined;
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'multipart/form-data') return undefined;
  const boundaryMatch = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/iu.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (boundary === undefined || boundary.length === 0 || boundary.length > 70) return undefined;
  if (
    !/^[\x20-\x7e]+$/u.test(boundary) ||
    [...boundary].some((character) => '()<>@,;:\\"/[]?='.includes(character))
  ) {
    return undefined;
  }
  return boundary;
}

function appendChunk(chunks: Uint8Array[], chunk: unknown): void {
  if (Buffer.isBuffer(chunk)) chunks.push(chunk);
  else if (chunk instanceof Uint8Array) chunks.push(chunk);
  else throw new InvalidMultipartRequestError('Multipart file chunk is unreadable');
}

async function readProductMultipartRequest(
  request: IncomingMessage,
  mode: 'create' | 'replace',
): Promise<ProductMultipartFields> {
  const contentType = request.headers['content-type'];
  const boundary = readMultipartBoundary(contentType);
  if (boundary === undefined || contentType === undefined) {
    discardRequest(request);
    throw new MultipartUnsupportedMediaTypeError();
  }
  const contentLength = request.headers['content-length'];
  if (contentLength !== undefined && Number(contentLength) > MAX_MULTIPART_BODY_BYTES) {
    discardRequest(request);
    throw new MultipartPayloadTooLargeError();
  }

  const fields: Record<string, string> = {};
  const imageChunks: Uint8Array[] = [];
  let imageFileCount = 0;
  let bodyBytes = 0;
  let fileTooLarge = false;
  let fieldTooLarge = false;
  let partsLimit = false;
  let fieldsLimit = false;
  let filesLimit = false;
  let parserError: unknown;
  const busboy = new Busboy({
    headers: { ...request.headers, 'content-type': contentType },
    isPartAFile: (fieldName) => fieldName === 'image',
    limits: {
      fieldSize: MAX_MULTIPART_FIELD_BYTES,
      fields: mode === 'create' ? 4 : 0,
      fileSize: MAX_MULTIPART_FILE_BYTES,
      files: 1,
      headerPairs: 200,
      parts: mode === 'create' ? 5 : 1,
    },
  });
  return await new Promise<ProductMultipartFields>((resolve, reject) => {
    request.on('data', (chunk: unknown) => {
      if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
        bodyBytes += chunk.byteLength;
        if (bodyBytes > MAX_MULTIPART_BODY_BYTES) bodyBytes = MAX_MULTIPART_BODY_BYTES + 1;
      }
    });
    busboy.on(
      'field',
      (name: string, value: string, nameTruncated: boolean, valueTruncated: boolean) => {
        if (nameTruncated || valueTruncated || fields[name] !== undefined) {
          if (valueTruncated) fieldTooLarge = true;
          parserError = new InvalidMultipartRequestError('Multipart field is invalid');
          return;
        }
        fields[name] = value;
      },
    );
    busboy.on('file', (name: string, file: BusboyFileStream) => {
      imageFileCount += 1;
      if (name !== 'image' || imageFileCount > 1) parserError = new InvalidMultipartRequestError();
      file.on('limit', () => {
        fileTooLarge = true;
      });
      file.on('data', (chunk: unknown) => {
        if (!fileTooLarge) {
          try {
            appendChunk(imageChunks, chunk);
          } catch (error) {
            parserError = error;
          }
        }
      });
      file.on('error', (error: unknown) => {
        parserError = error;
      });
    });
    busboy.on('partsLimit', () => {
      partsLimit = true;
    });
    busboy.on('fieldsLimit', () => {
      fieldsLimit = true;
    });
    busboy.on('filesLimit', () => {
      filesLimit = true;
    });
    busboy.on('error', (error: unknown) => {
      parserError = error;
      request.resume();
      reject(new InvalidMultipartRequestError());
    });
    busboy.on('finish', () => {
      request.removeAllListeners('data');
      if (bodyBytes > MAX_MULTIPART_BODY_BYTES || fileTooLarge || fieldTooLarge) {
        reject(new MultipartPayloadTooLargeError());
        return;
      }
      if (parserError !== undefined || partsLimit || fieldsLimit || filesLimit) {
        reject(new InvalidMultipartRequestError());
        return;
      }
      if (imageFileCount !== 1 || imageChunks.length === 0) {
        reject(new InvalidMultipartRequestError());
        return;
      }
      const allowedFields =
        mode === 'create' ? ['categoryId', 'name', 'basePriceMinor', 'adminEnabled'] : [];
      if (Object.keys(fields).some((field) => !allowedFields.includes(field))) {
        reject(new InvalidMultipartRequestError());
        return;
      }
      if (mode === 'create' && Object.keys(fields).length !== 4) {
        reject(new InvalidMultipartRequestError());
        return;
      }
      resolve({
        ...(fields.categoryId === undefined ? {} : { categoryId: fields.categoryId }),
        ...(fields.name === undefined ? {} : { name: fields.name }),
        ...(fields.basePriceMinor === undefined ? {} : { basePriceMinor: fields.basePriceMinor }),
        ...(fields.adminEnabled === undefined ? {} : { adminEnabled: fields.adminEnabled }),
        image: Buffer.concat(imageChunks.map((chunk) => Buffer.from(chunk))),
      });
    });
    request.pipe(busboy);
  });
}

function parseMultipartCreateFields(fields: ProductMultipartFields): {
  readonly categoryId: string;
  readonly name: string;
  readonly basePriceMinor: number;
  readonly adminEnabled: boolean;
  readonly image: Uint8Array;
} {
  if (
    fields.categoryId === undefined ||
    fields.name === undefined ||
    fields.basePriceMinor === undefined ||
    fields.adminEnabled === undefined ||
    fields.image === undefined ||
    !/^\d+$/u.test(fields.basePriceMinor) ||
    !['true', 'false'].includes(fields.adminEnabled)
  ) {
    throw new InvalidMultipartRequestError();
  }
  const basePriceMinor = Number(fields.basePriceMinor);
  if (!Number.isSafeInteger(basePriceMinor)) throw new InvalidMultipartRequestError();
  return {
    adminEnabled: fields.adminEnabled === 'true',
    basePriceMinor,
    categoryId: fields.categoryId,
    image: fields.image,
    name: fields.name,
  };
}

function productResponse(product: Product): Record<string, unknown> {
  return Object.fromEntries(Object.entries(product).filter(([key]) => key !== 'imageRevision'));
}

function requireImageDependencies(dependencies: RequestHandlerDependencies): {
  readonly imageProcessor: ProductImageProcessor;
  readonly objectStorage: ObjectStorage;
  readonly imageMutationGuard: ImageMutationGuard;
  readonly productIdGenerator: () => string;
  readonly imageRevisionGenerator: () => string;
} {
  if (
    dependencies.imageProcessor === undefined ||
    dependencies.objectStorage === undefined ||
    dependencies.imageMutationGuard === undefined ||
    dependencies.productIdGenerator === undefined ||
    dependencies.imageRevisionGenerator === undefined
  ) {
    throw new Error('Product image dependencies are not configured');
  }
  return {
    imageMutationGuard: dependencies.imageMutationGuard,
    imageProcessor: dependencies.imageProcessor,
    imageRevisionGenerator: dependencies.imageRevisionGenerator,
    objectStorage: dependencies.objectStorage,
    productIdGenerator: dependencies.productIdGenerator,
  };
}

function sendProductImageError(response: ServerResponse, error: unknown): boolean {
  if (
    error instanceof ProductImageCreateAuthorizationError ||
    error instanceof ProductImageUpdateAuthorizationError
  ) {
    sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
    return true;
  }
  if (error instanceof ProductImageConflictError) {
    sendJson(response, 409, buildErrorResponse('CONFLICT'));
    return true;
  }
  if (error instanceof ProductImageNotFoundError || error instanceof ProductImageMissingError) {
    sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
    return true;
  }
  if (error instanceof ProductImageRateLimitError) {
    sendJson(response, 409, buildErrorResponse('CONFLICT'));
    return true;
  }
  if (error instanceof ProductImageProcessingError) {
    sendJson(response, 422, buildErrorResponse('INVALID_IMAGE'));
    return true;
  }
  if (error instanceof ProductImageStorageError) {
    sendJson(response, 503, buildErrorResponse('STORAGE_UNAVAILABLE'));
    return true;
  }
  return false;
}

async function sendStoredImage(
  response: ServerResponse,
  body: StoredObject,
  headers: Readonly<Record<string, string>>,
): Promise<void> {
  response.writeHead(200, {
    'Cache-Control': 'private, no-cache',
    'Content-Type': 'image/webp',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  if (body instanceof Uint8Array) {
    response.end(Buffer.from(body));
    return;
  }
  try {
    for await (const chunk of body) response.write(Buffer.from(chunk));
    response.end();
  } catch {
    response.destroy();
  }
}

async function readJsonRequestBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'];
  if (
    typeof contentType !== 'string' ||
    contentType.split(';', 1)[0]?.trim() !== 'application/json'
  ) {
    throw new InvalidJsonRequestError('Request must use application/json');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const rawChunk of request as AsyncIterable<unknown>) {
    if (typeof rawChunk !== 'string' && !Buffer.isBuffer(rawChunk)) {
      throw new InvalidJsonRequestError('Request body is not readable');
    }
    const buffer = typeof rawChunk === 'string' ? Buffer.from(rawChunk) : rawChunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new InvalidJsonRequestError('Request body is too large');
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new InvalidJsonRequestError('Request body is not valid JSON');
  }
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://api.local');
  if (requestUrl.pathname === HEALTH_PATH) {
    if (request.method !== 'GET') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
        Allow: 'GET',
      });
      return;
    }

    sendJson(response, 200, buildHealthResponse(dependencies.version, dependencies.now));
    return;
  }

  const productImageMatch = requestUrl.pathname.match(PRODUCT_IMAGE_PATH);
  if (productImageMatch !== null) {
    if (request.method !== 'GET') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'GET' });
      return;
    }
    const repository = dependencies.productRepository;
    const objectStorage = dependencies.objectStorage;
    if (repository === undefined) throw new Error('Product repository is not configured');
    if (objectStorage === undefined) throw new Error('Product image storage is not configured');
    try {
      const image = await loadVisibleProductImage({
        imageRevision: productImageMatch[2] ?? '',
        objectStorage,
        productId: productImageMatch[1] ?? '',
        repository,
      });
      const etag = `"${image.etag}"`;
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, {
          'Cache-Control': 'private, no-cache',
          ETag: etag,
          'X-Content-Type-Options': 'nosniff',
        });
        response.end();
        return;
      }
      await sendStoredImage(response, image.body, { ETag: etag });
    } catch (error) {
      if (!sendProductImageError(response, error)) throw error;
    }
    return;
  }

  const v2AdminImageMatch = requestUrl.pathname.match(V2_ADMIN_PRODUCT_IMAGE_PATH);
  if (v2AdminImageMatch !== null) {
    if (request.method !== 'PUT') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'PUT' });
      return;
    }
    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      discardRequest(request);
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }
    const imageDependencies = requireImageDependencies(dependencies);
    const reservation = imageDependencies.imageMutationGuard.reserve(principal);
    if (reservation === undefined) {
      discardRequest(request);
      sendJson(response, 409, buildErrorResponse('CONFLICT'));
      return;
    }
    try {
      const fields = await readProductMultipartRequest(request, 'replace');
      if (fields.image === undefined) throw new InvalidMultipartRequestError();
      const product = await replaceProductImage({
        image: fields.image,
        imageProcessor: imageDependencies.imageProcessor,
        imageRevisionGenerator: imageDependencies.imageRevisionGenerator,
        objectStorage: imageDependencies.objectStorage,
        principal,
        productId: v2AdminImageMatch[1] ?? '',
        repository,
      });
      const imageProduct = toProductWithImage(product, dependencies.publicApiBaseUrl);
      sendJson(response, 200, ProductWithImageResponseSchema.parse(productResponse(imageProduct)));
    } catch (error) {
      if (error instanceof MultipartUnsupportedMediaTypeError) {
        sendJson(response, 415, buildErrorResponse('UNSUPPORTED_MEDIA_TYPE'));
      } else if (error instanceof MultipartPayloadTooLargeError) {
        sendJson(response, 413, buildErrorResponse('PAYLOAD_TOO_LARGE'));
      } else if (error instanceof InvalidMultipartRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      } else if (!sendProductImageError(response, error)) {
        throw error;
      }
    } finally {
      reservation.release();
    }
    return;
  }

  if (requestUrl.pathname === V2_ADMIN_PRODUCTS_PATH) {
    if (request.method !== 'POST') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'POST' });
      return;
    }
    const repository = dependencies.productRepository;
    const categoryReferenceRepository = dependencies.productCategoryReferenceRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    if (categoryReferenceRepository === undefined) {
      throw new Error('Product category reference repository is not configured');
    }
    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      discardRequest(request);
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }
    const imageDependencies = requireImageDependencies(dependencies);
    const reservation = imageDependencies.imageMutationGuard.reserve(principal);
    if (reservation === undefined) {
      discardRequest(request);
      sendJson(response, 409, buildErrorResponse('CONFLICT'));
      return;
    }
    try {
      const fields = parseMultipartCreateFields(
        await readProductMultipartRequest(request, 'create'),
      );
      const parsedProduct = CreateProductRequestSchema.safeParse({
        adminEnabled: fields.adminEnabled,
        basePriceMinor: fields.basePriceMinor,
        categoryId: fields.categoryId,
        name: fields.name,
      });
      if (!parsedProduct.success) throw new InvalidMultipartRequestError();
      const product = await createProductWithImage({
        categoryReferenceRepository,
        image: fields.image,
        imageProcessor: imageDependencies.imageProcessor,
        imageRevisionGenerator: imageDependencies.imageRevisionGenerator,
        objectStorage: imageDependencies.objectStorage,
        principal,
        product: parsedProduct.data,
        productIdGenerator: imageDependencies.productIdGenerator,
        repository,
      });
      const imageProduct = toProductWithImage(product, dependencies.publicApiBaseUrl);
      sendJson(response, 201, ProductWithImageResponseSchema.parse(productResponse(imageProduct)));
    } catch (error) {
      if (error instanceof MultipartUnsupportedMediaTypeError) {
        sendJson(response, 415, buildErrorResponse('UNSUPPORTED_MEDIA_TYPE'));
      } else if (error instanceof MultipartPayloadTooLargeError) {
        sendJson(response, 413, buildErrorResponse('PAYLOAD_TOO_LARGE'));
      } else if (error instanceof InvalidMultipartRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      } else if (error instanceof ProductCategoryNotFoundError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
      } else if (!sendProductImageError(response, error)) {
        throw error;
      }
    } finally {
      reservation.release();
    }
    return;
  }

  const v2ProductDetailsMatch = requestUrl.pathname.match(V2_PRODUCT_DETAILS_PATH);
  if (v2ProductDetailsMatch !== null || requestUrl.pathname === V2_PRODUCTS_PATH) {
    if (request.method !== 'GET') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'GET' });
      return;
    }
    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    try {
      if (v2ProductDetailsMatch !== null) {
        const details = await getVisibleProductDetails(v2ProductDetailsMatch[1] ?? '', repository);
        if (details === undefined) {
          sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
          return;
        }
        const imageProduct = toProductWithImage(details.product, dependencies.publicApiBaseUrl);
        sendJson(
          response,
          200,
          ProductDetailsWithImageResponseSchema.parse({
            ...productResponse(imageProduct),
            categoryName: details.categoryName,
          }),
        );
      } else {
        const products = (await listProducts(repository)).map((product) =>
          productResponse(toProductWithImage(product, dependencies.publicApiBaseUrl)),
        );
        sendJson(response, 200, ProductWithImageListResponseSchema.parse(products));
      }
    } catch (error) {
      if (error instanceof ProductNotFoundError || error instanceof ProductImageMissingError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
      } else {
        throw error;
      }
    }
    return;
  }

  if (requestUrl.pathname === ADMIN_CATEGORIES_PATH || requestUrl.pathname === CATEGORIES_PATH) {
    const isAdminCreateRequest = requestUrl.pathname === ADMIN_CATEGORIES_PATH;
    const allowedMethods = isAdminCreateRequest ? ['POST'] : ['GET'];
    if (request.method === undefined || !allowedMethods.includes(request.method)) {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
        Allow: allowedMethods.join(', '),
      });
      return;
    }

    const repository = dependencies.categoryRepository;
    if (repository === undefined) throw new Error('Category repository is not configured');

    if (!isAdminCreateRequest) {
      const categories = await listCategories(repository);
      sendJson(response, 200, CategoryListResponseSchema.parse(categories));
      return;
    }

    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }

    let body: unknown;
    try {
      body = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }

    const parsedBody = CreateCategoryRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }

    try {
      const category = await createCategory(principal, parsedBody.data, repository);
      sendJson(response, 201, CategoryResponseSchema.parse(category));
    } catch (error) {
      if (error instanceof CategoryAuthorizationError) {
        sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
        return;
      }
      throw error;
    }
    return;
  }

  const adminProductVisibilityMatch = requestUrl.pathname.match(ADMIN_PRODUCT_VISIBILITY_PATH);
  if (adminProductVisibilityMatch !== null) {
    if (request.method !== 'PATCH') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'PATCH' });
      return;
    }
    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      discardRequest(request);
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }
    let body: unknown;
    try {
      body = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }
    const parsedBody = UpdateProductVisibilityRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    try {
      const product = await updateProductVisibility(
        principal,
        { id: adminProductVisibilityMatch[1] ?? '', ...parsedBody.data },
        repository,
      );
      sendJson(response, 200, ProductResponseSchema.parse(productResponse(product)));
    } catch (error) {
      if (error instanceof ProductVisibilityUpdateAuthorizationError) {
        sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
        return;
      }
      if (error instanceof ProductNotFoundError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
        return;
      }
      throw error;
    }
    return;
  }

  const adminProductDetailsMatch = requestUrl.pathname.match(ADMIN_PRODUCT_DETAILS_PATH);
  if (adminProductDetailsMatch !== null) {
    if (request.method !== 'PATCH') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'PATCH' });
      return;
    }
    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }
    let body: unknown;
    try {
      body = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }
    const parsedBody = UpdateProductDetailsRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    try {
      const product = await updateProductDetails(
        principal,
        { id: adminProductDetailsMatch[1] ?? '', ...parsedBody.data },
        repository,
      );
      sendJson(response, 200, ProductResponseSchema.parse(productResponse(product)));
    } catch (error) {
      if (error instanceof ProductUpdateAuthorizationError) {
        sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
        return;
      }
      if (error instanceof ProductNotFoundError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
        return;
      }
      throw error;
    }
    return;
  }

  const productDetailsMatch = requestUrl.pathname.match(PRODUCT_DETAILS_PATH);
  if (productDetailsMatch !== null) {
    if (request.method !== 'GET') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), { Allow: 'GET' });
      return;
    }
    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');
    try {
      const details = await getVisibleProductDetails(productDetailsMatch[1] ?? '', repository);
      if (details === undefined) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
        return;
      }
      sendJson(
        response,
        200,
        ProductDetailsResponseSchema.parse({
          ...productResponse(details.product),
          categoryName: details.categoryName,
        }),
      );
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
        return;
      }
      throw error;
    }
    return;
  }

  if (requestUrl.pathname === ADMIN_PRODUCTS_PATH || requestUrl.pathname === PRODUCTS_PATH) {
    const isAdminCreateRequest = requestUrl.pathname === ADMIN_PRODUCTS_PATH;
    const allowedMethods = isAdminCreateRequest ? ['GET', 'POST'] : ['GET'];
    if (request.method === undefined || !allowedMethods.includes(request.method)) {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
        Allow: allowedMethods.join(', '),
      });
      return;
    }

    const repository = dependencies.productRepository;
    if (repository === undefined) throw new Error('Product repository is not configured');

    if (request.method === 'GET') {
      if (isAdminCreateRequest) {
        const principal = dependencies.adminIdentityResolver?.resolve({
          rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
        });
        if (principal === undefined) {
          sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
          return;
        }
      }
      const products = isAdminCreateRequest
        ? await listAdminProducts(repository)
        : await listProducts(repository);
      sendJson(
        response,
        200,
        ProductListResponseSchema.parse(products.map((product) => productResponse(product))),
      );
      return;
    }

    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }
    if (dependencies.productImageWriteFrozen) {
      discardRequest(request);
      sendJson(response, 410, buildErrorResponse('LEGACY_ENDPOINT_DISABLED'));
      return;
    }

    let body: unknown;
    try {
      body = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }

    const parsedBody = CreateProductRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }

    const categoryReferenceRepository = dependencies.productCategoryReferenceRepository;
    if (categoryReferenceRepository === undefined) {
      throw new Error('Product category reference repository is not configured');
    }

    try {
      const product = await createProduct(
        principal,
        parsedBody.data,
        repository,
        categoryReferenceRepository,
      );
      sendJson(response, 201, ProductResponseSchema.parse(productResponse(product)));
    } catch (error) {
      if (error instanceof ProductAuthorizationError) {
        sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
        return;
      }
      if (error instanceof ProductCategoryNotFoundError) {
        sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
        return;
      }
      throw error;
    }
    return;
  }

  if (
    requestUrl.pathname !== CUSTOMER_PROFILE_PATH &&
    requestUrl.pathname !== LEGAL_ACCEPTANCES_PATH
  ) {
    sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
    return;
  }

  const isProfileRequest = requestUrl.pathname === CUSTOMER_PROFILE_PATH;
  const allowedMethods = isProfileRequest ? ['GET', 'PATCH'] : ['GET', 'POST'];
  if (request.method === undefined || !allowedMethods.includes(request.method)) {
    sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
      Allow: allowedMethods.join(', '),
    });
    return;
  }

  const identity = dependencies.identityResolver?.resolve({
    rawHeader: request.headers[DEVELOPMENT_IDENTITY_HEADER],
  });
  if (identity === undefined) {
    sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
    return;
  }

  const repository = dependencies.customerProfileRepository;
  if (repository === undefined) throw new Error('Customer profile repository is not configured');

  if (!isProfileRequest) {
    const legalAcceptanceRepository = dependencies.legalAcceptanceRepository;
    if (legalAcceptanceRepository === undefined) {
      throw new Error('Legal acceptance repository is not configured');
    }

    if (request.method === 'GET') {
      const legalAcceptances = await getCurrentLegalAcceptances(
        identity,
        repository,
        legalAcceptanceRepository,
      );
      sendJson(response, 200, LegalAcceptanceResponseSchema.parse(legalAcceptances));
      return;
    }

    let legalBody: unknown;
    try {
      legalBody = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }
    const parsedLegalBody = RecordLegalAcceptanceRequestSchema.safeParse(legalBody);
    if (!parsedLegalBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    const legalAcceptances = await recordCurrentLegalAcceptance(
      identity,
      parsedLegalBody.data.documentType,
      repository,
      legalAcceptanceRepository,
    );
    sendJson(response, 200, LegalAcceptanceResponseSchema.parse(legalAcceptances));
    return;
  }

  if (request.method === 'GET') {
    const profile = await getCurrentCustomerProfile(identity, repository);
    sendJson(response, 200, CustomerProfileResponseSchema.parse(profile));
    return;
  }

  let body: unknown;
  try {
    body = await readJsonRequestBody(request);
  } catch (error) {
    if (error instanceof InvalidJsonRequestError) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    throw error;
  }

  const parsedBody = CustomerProfilePatchRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
    return;
  }

  const changes: CustomerProfileUpdate = {
    ...(parsedBody.data.name === undefined ? {} : { name: parsedBody.data.name }),
    ...(parsedBody.data.birthday === undefined ? {} : { birthday: parsedBody.data.birthday }),
  };

  const profile = await updateCurrentCustomerProfile(identity, changes, repository);
  sendJson(response, 200, CustomerProfileResponseSchema.parse(profile));
}

export function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): void {
  void routeRequest(request, response, dependencies).catch(() => {
    console.error('request_handler_failed: unexpected_http_handler_error');
    if (!response.headersSent) sendJson(response, 500, buildErrorResponse('INTERNAL_SERVER_ERROR'));
    else response.destroy();
  });
}

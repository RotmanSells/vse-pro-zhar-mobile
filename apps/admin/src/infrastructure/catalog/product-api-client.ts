import {
  CreateProductRequestSchema,
  ProductListResponseSchema,
  ProductResponseSchema,
  ProductWithImageResponseSchema,
  UpdateProductDetailsRequestSchema,
  UpdateProductVisibilityRequestSchema,
} from '../../../../../packages/contracts/src/product';
import { readConfiguredAdminApiBaseUrl } from './api-config';
import type {
  AdminProductFailureReason,
  ProductCatalogPort,
  LoadProductsResult,
  UpdateProductImageResult,
  UpdateProductDetailsResult,
  UpdateProductVisibilityResult,
} from '../../application/catalog/product';
export const PRODUCT_REQUEST_TIMEOUT_MS = 3_000;
export interface ProductFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}
export interface CreateProductApiClientOptions {
  readonly apiBaseUrl?: unknown;
  readonly fetchImpl?: ProductFetch;
  readonly timeoutMs?: number;
}
function failure(reason: AdminProductFailureReason): {
  kind: 'failure';
  reason: AdminProductFailureReason;
} {
  return { kind: 'failure', reason };
}
function mapHttpFailure(status: number): AdminProductFailureReason {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 413) return 'payload_too_large';
  if (status === 422) return 'invalid_image';
  if (status === 503) return 'storage';
  return 'http';
}
export function createProductApiClient(
  options: CreateProductApiClientOptions = {},
): ProductCatalogPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PRODUCT_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = readConfiguredAdminApiBaseUrl(options.apiBaseUrl);
  return {
    async createProduct(input) {
      if (apiBaseUrl === undefined) return failure('configuration');
      const { image, ...productInput } = input;
      const parsedInput = CreateProductRequestSchema.safeParse(productInput);
      if (!parsedInput.success) return failure('invalid_request');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const form =
          image === undefined
            ? undefined
            : (() => {
                const value = new FormData();
                value.append('categoryId', parsedInput.data.categoryId);
                value.append('name', parsedInput.data.name);
                value.append('basePriceMinor', String(parsedInput.data.basePriceMinor));
                value.append('adminEnabled', String(parsedInput.data.adminEnabled));
                value.append('image', image, 'product-image');
                return value;
              })();
        let response: Response;
        try {
          response = await fetchImpl(
            image === undefined
              ? `${apiBaseUrl}/admin/products`
              : `${apiBaseUrl}/v2/admin/products`,
            {
              body: form ?? JSON.stringify(parsedInput.data),
              headers: {
                Accept: 'application/json',
                ...(form === undefined ? { 'Content-Type': 'application/json' } : {}),
                'X-VPZH-Development-Admin-Identity': 'admin',
              },
              method: 'POST',
              signal: controller.signal,
            },
          );
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (!response.ok) return failure(mapHttpFailure(response.status));
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedImageProduct = ProductWithImageResponseSchema.safeParse(payload);
        if (parsedImageProduct.success)
          return { kind: 'created' as const, product: parsedImageProduct.data };
        const parsedProduct = ProductResponseSchema.safeParse(payload);
        return parsedProduct.success
          ? { kind: 'created' as const, product: parsedProduct.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
    async listProducts(): Promise<LoadProductsResult> {
      if (apiBaseUrl === undefined) return failure('configuration');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/admin/products`, {
            headers: {
              Accept: 'application/json',
              'X-VPZH-Development-Admin-Identity': 'admin',
            },
            method: 'GET',
            signal: controller.signal,
          });
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (!response.ok) return failure('http');
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedProducts = ProductListResponseSchema.safeParse(payload);
        return parsedProducts.success
          ? { kind: 'loaded' as const, products: parsedProducts.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
    async updateProductDetails(input): Promise<UpdateProductDetailsResult> {
      if (apiBaseUrl === undefined) return failure('configuration');
      const { id, ...details } = input;
      if (!ProductResponseSchema.shape.id.safeParse(id).success) return failure('invalid_request');
      const parsedInput = UpdateProductDetailsRequestSchema.safeParse(details);
      if (!parsedInput.success) return failure('invalid_request');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/admin/products/${id}/details`, {
            body: JSON.stringify(parsedInput.data),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-VPZH-Development-Admin-Identity': 'admin',
            },
            method: 'PATCH',
            signal: controller.signal,
          });
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (!response.ok) {
          if (response.status === 401) return failure('unauthorized');
          if (response.status === 403) return failure('forbidden');
          if (response.status === 404) return failure('not_found');
          return failure('http');
        }
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedProduct = ProductResponseSchema.safeParse(payload);
        return parsedProduct.success
          ? { kind: 'updated' as const, product: parsedProduct.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
    async updateProductVisibility(input): Promise<UpdateProductVisibilityResult> {
      if (apiBaseUrl === undefined) return failure('configuration');
      if (!ProductResponseSchema.shape.id.safeParse(input.id).success) {
        return failure('invalid_request');
      }
      const parsedInput = UpdateProductVisibilityRequestSchema.safeParse({
        adminEnabled: input.adminEnabled,
      });
      if (!parsedInput.success) return failure('invalid_request');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/admin/products/${input.id}/visibility`, {
            body: JSON.stringify(parsedInput.data),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-VPZH-Development-Admin-Identity': 'admin',
            },
            method: 'PATCH',
            signal: controller.signal,
          });
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (!response.ok) return failure(mapHttpFailure(response.status));
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedProduct = ProductResponseSchema.safeParse(payload);
        return parsedProduct.success
          ? { kind: 'updated' as const, product: parsedProduct.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
    async replaceProductImage(input): Promise<UpdateProductImageResult> {
      if (apiBaseUrl === undefined) return failure('configuration');
      if (!ProductResponseSchema.shape.id.safeParse(input.id).success)
        return failure('invalid_request');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const form = new FormData();
        form.append('image', input.image, 'product-image');
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/v2/admin/products/${input.id}/image`, {
            body: form,
            headers: {
              Accept: 'application/json',
              'X-VPZH-Development-Admin-Identity': 'admin',
            },
            method: 'PUT',
            signal: controller.signal,
          });
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (!response.ok) return failure(mapHttpFailure(response.status));
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedProduct = ProductWithImageResponseSchema.safeParse(payload);
        return parsedProduct.success
          ? { kind: 'updated' as const, product: parsedProduct.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

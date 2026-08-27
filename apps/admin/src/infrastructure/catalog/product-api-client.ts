import {
  CreateProductRequestSchema,
  ProductListResponseSchema,
  ProductResponseSchema,
  UpdateProductDetailsRequestSchema,
} from '../../../../../packages/contracts/src/product';
import { readConfiguredAdminApiBaseUrl } from './api-config';
import type {
  AdminProductFailureReason,
  ProductCatalogPort,
  LoadProductsResult,
  UpdateProductDetailsResult,
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
export function createProductApiClient(
  options: CreateProductApiClientOptions = {},
): ProductCatalogPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PRODUCT_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = readConfiguredAdminApiBaseUrl(options.apiBaseUrl);
  return {
    async createProduct(input) {
      if (apiBaseUrl === undefined) return failure('configuration');
      const parsedInput = CreateProductRequestSchema.safeParse(input);
      if (!parsedInput.success) return failure('invalid_request');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/admin/products`, {
            body: JSON.stringify(parsedInput.data),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'X-VPZH-Development-Admin-Identity': 'admin',
            },
            method: 'POST',
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
          response = await fetchImpl(`${apiBaseUrl}/products`, {
            headers: { Accept: 'application/json' },
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
  };
}

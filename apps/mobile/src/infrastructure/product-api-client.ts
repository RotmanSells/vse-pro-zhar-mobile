import {
  ProductDetailsResponseSchema,
  ProductDetailsWithImageResponseSchema,
  ProductListResponseSchema,
  ProductWithImageListResponseSchema,
} from '@vse-pro-zhar/contracts';
import type {
  ProductDetailsLoadFailureReason,
  ProductDetailsLoadResult,
  ProductDetailsPort,
  ProductLoadFailureReason,
  ProductListPort,
  ProductLoadResult,
} from '../application/catalog/product.ts';
export const PRODUCT_REQUEST_TIMEOUT_MS = 3_000;
export interface ProductFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface ProductApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly apiVersion?: 'v1' | 'v2';
  readonly fetchImpl?: ProductFetch;
  readonly timeoutMs?: number;
}
function failure(reason: ProductLoadFailureReason): ProductLoadResult;
function failure(reason: 'not_found'): ProductDetailsLoadResult;
function failure(
  reason: ProductLoadFailureReason | 'not_found',
): ProductLoadResult | ProductDetailsLoadResult {
  return { kind: 'failure', reason };
}

function detailsFailure(reason: ProductDetailsLoadFailureReason): ProductDetailsLoadResult {
  return { kind: 'failure', reason };
}
export interface ProductCatalogPort extends ProductListPort, ProductDetailsPort {}

export function createProductApiClient(options: ProductApiClientOptions): ProductCatalogPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PRODUCT_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;
  const apiVersion = options.apiVersion ?? 'v1';
  const productsPath = apiVersion === 'v2' ? '/v2/products' : '/products';
  return {
    async listProducts(): Promise<ProductLoadResult> {
      if (apiBaseUrl === undefined) return failure('configuration');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}${productsPath}`, {
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
        const parsed =
          apiVersion === 'v2'
            ? ProductWithImageListResponseSchema.safeParse(payload)
            : ProductListResponseSchema.safeParse(payload);
        return parsed.success
          ? { kind: 'loaded', products: parsed.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
    async getProduct(id: string): Promise<ProductDetailsLoadResult> {
      if (apiBaseUrl === undefined) return detailsFailure('configuration');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}${productsPath}/${encodeURIComponent(id)}`, {
            headers: { Accept: 'application/json' },
            method: 'GET',
            signal: controller.signal,
          });
        } catch {
          return detailsFailure(controller.signal.aborted ? 'timeout' : 'network');
        }
        if (response.status === 404) return detailsFailure('not_found');
        if (!response.ok) return detailsFailure('http');
        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return detailsFailure('invalid_response');
        }
        const parsed =
          apiVersion === 'v2'
            ? ProductDetailsWithImageResponseSchema.safeParse(payload)
            : ProductDetailsResponseSchema.safeParse(payload);
        return parsed.success
          ? { kind: 'loaded', product: parsed.data }
          : detailsFailure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

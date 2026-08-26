import {
  CreateProductRequestSchema,
  ProductResponseSchema,
} from '../../../../../packages/contracts/src/product';
import { readConfiguredAdminApiBaseUrl } from './api-config';
import type {
  AdminProductFailureReason,
  CreateProductPort,
  CreateProductResult,
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
function failure(reason: AdminProductFailureReason): CreateProductResult {
  return { kind: 'failure', reason };
}
export function createProductApiClient(
  options: CreateProductApiClientOptions = {},
): CreateProductPort {
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
  };
}

import {
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
} from '../../../../../packages/contracts/src/category';
import { ApiErrorResponseSchema } from '../../../../../packages/contracts/src/health';

import type {
  AdminCategoryPort,
  CategoryListFailureReason,
  CreateCategoryResult,
} from '../../application/catalog/category';
import { readConfiguredAdminApiBaseUrl } from './api-config';

export { readConfiguredAdminApiBaseUrl } from './api-config';

export const CATEGORY_REQUEST_TIMEOUT_MS = 3_000;

export interface CategoryFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateCategoryApiClientOptions {
  readonly apiBaseUrl?: unknown;
  readonly fetchImpl?: CategoryFetch;
  readonly timeoutMs?: number;
}

function failure(
  reason: Extract<CreateCategoryResult, { kind: 'failure' }>['reason'],
): CreateCategoryResult {
  return { kind: 'failure', reason };
}

function listFailure(reason: CategoryListFailureReason) {
  return { kind: 'failure' as const, reason };
}

export function createCategoryApiClient(
  options: CreateCategoryApiClientOptions = {},
): AdminCategoryPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CATEGORY_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = readConfiguredAdminApiBaseUrl(options.apiBaseUrl);

  return {
    async createCategory(input) {
      if (apiBaseUrl === undefined) return failure('configuration');

      const parsedInput = CreateCategoryRequestSchema.safeParse(input);
      if (!parsedInput.success) return failure('invalid_request');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/admin/categories`, {
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
          return failure('http');
        }

        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsedCategory = CategoryResponseSchema.safeParse(payload);
        return parsedCategory.success
          ? { kind: 'created', category: parsedCategory.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },

    async listCategories() {
      if (apiBaseUrl === undefined) return listFailure('configuration');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/categories`, {
            headers: { Accept: 'application/json' },
            method: 'GET',
            signal: controller.signal,
          });
        } catch {
          return listFailure(controller.signal.aborted ? 'timeout' : 'network');
        }

        if (!response.ok) return listFailure('http');

        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return listFailure('invalid_response');
        }
        const parsedCategories = CategoryListResponseSchema.safeParse(payload);
        return parsedCategories.success
          ? { kind: 'loaded' as const, categories: parsedCategories.data }
          : listFailure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function parseCategoryApiError(
  payload: unknown,
): { readonly kind: 'error'; readonly code: string } | { readonly kind: 'invalid' } {
  const parsed = ApiErrorResponseSchema.safeParse(payload);
  return parsed.success ? { kind: 'error', code: parsed.data.error.code } : { kind: 'invalid' };
}

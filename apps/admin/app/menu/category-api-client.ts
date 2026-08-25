import {
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
} from '../../../../packages/contracts/src/category';
import { ApiErrorResponseSchema } from '../../../../packages/contracts/src/health';

import type {
  CreateCategoryPort,
  CreateCategoryResult,
} from '../../src/application/catalog/category';

export const CATEGORY_REQUEST_TIMEOUT_MS = 3_000;

export interface CategoryFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateCategoryApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly fetchImpl?: CategoryFetch;
  readonly timeoutMs?: number;
}

function failure(
  reason: Extract<CreateCategoryResult, { kind: 'failure' }>['reason'],
): CreateCategoryResult {
  return { kind: 'failure', reason };
}

export function createCategoryApiClient(
  options: CreateCategoryApiClientOptions,
): CreateCategoryPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CATEGORY_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;

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
  };
}

export function readConfiguredAdminApiBaseUrl(
  value: unknown = process.env.NEXT_PUBLIC_API_URL,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return value.replace(/\/$/u, '');
  } catch {
    return undefined;
  }
}

export function parseCategoryApiError(
  payload: unknown,
): { readonly kind: 'error'; readonly code: string } | { readonly kind: 'invalid' } {
  const parsed = ApiErrorResponseSchema.safeParse(payload);
  return parsed.success ? { kind: 'error', code: parsed.data.error.code } : { kind: 'invalid' };
}

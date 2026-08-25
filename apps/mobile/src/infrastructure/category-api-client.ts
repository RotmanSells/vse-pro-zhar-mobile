import { CategoryListResponseSchema } from '@vse-pro-zhar/contracts';

import type {
  CategoryListPort,
  CategoryLoadFailureReason,
  CategoryLoadResult,
} from '../application/catalog/category.ts';

export const CATEGORY_REQUEST_TIMEOUT_MS = 3_000;

export interface CategoryFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateCategoryApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly fetchImpl?: CategoryFetch;
  readonly timeoutMs?: number;
}

function failure(reason: CategoryLoadFailureReason): CategoryLoadResult {
  return { kind: 'failure', reason };
}

export function createCategoryApiClient(options: CreateCategoryApiClientOptions): CategoryListPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CATEGORY_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;

  return {
    async listCategories(): Promise<CategoryLoadResult> {
      if (apiBaseUrl === undefined) return failure('configuration');

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
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }

        if (!response.ok) return failure('http');

        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure('invalid_response');
        }
        const parsed = CategoryListResponseSchema.safeParse(payload);
        return parsed.success
          ? { kind: 'loaded', categories: parsed.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

import { CustomerProfileResponseSchema } from '@vse-pro-zhar/contracts';

import type {
  CurrentCustomerProfilePort,
  CurrentCustomerProfileResult,
  CustomerProfileFailureReason,
} from '../application/customer-profile.ts';

export const CUSTOMER_PROFILE_REQUEST_TIMEOUT_MS = 3_000;

export interface CustomerProfileFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateCustomerProfileApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly fetchImpl?: CustomerProfileFetch;
  readonly timeoutMs?: number;
}

function failure(reason: CustomerProfileFailureReason): CurrentCustomerProfileResult {
  return { kind: 'failure', reason };
}

export function createCustomerProfileApiClient(
  options: CreateCustomerProfileApiClientOptions,
): CurrentCustomerProfilePort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CUSTOMER_PROFILE_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;

  return {
    async getCurrentProfile(identity): Promise<CurrentCustomerProfileResult> {
      if (apiBaseUrl === undefined) return failure('configuration');

      const phone = identity.phone.trim();
      if (phone.length === 0) return failure('unauthorized');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(`${apiBaseUrl}/me/profile`, {
            headers: {
              Accept: 'application/json',
              'X-VPZH-Development-Identity': phone,
            },
            method: 'GET',
            signal: controller.signal,
          });
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'network');
        }

        if (!response.ok) {
          return failure(response.status === 401 ? 'unauthorized' : 'http');
        }

        let payload: unknown;
        try {
          payload = (await response.json()) as unknown;
        } catch {
          return failure(controller.signal.aborted ? 'timeout' : 'invalid_response');
        }

        const parsed = CustomerProfileResponseSchema.safeParse(payload);
        return parsed.success
          ? { kind: 'profile', profile: parsed.data }
          : failure('invalid_response');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

import { HealthResponseSchema } from '@vse-pro-zhar/contracts';

import type { HealthCheckPort, HealthCheckResult } from '../application/check-api-health.ts';

export const HEALTH_REQUEST_TIMEOUT_MS = 3_000;

export interface HealthFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateHealthApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly fetchImpl?: HealthFetch;
  readonly timeoutMs?: number;
}

function unhealthy(
  reason: Extract<HealthCheckResult, { kind: 'unhealthy' }>['reason'],
): HealthCheckResult {
  return { kind: 'unhealthy', reason };
}

export function createHealthApiClient(options: CreateHealthApiClientOptions): HealthCheckPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? HEALTH_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;

  return {
    async check(): Promise<HealthCheckResult> {
      if (apiBaseUrl === undefined) return unhealthy('configuration');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${apiBaseUrl}/health`, {
          headers: { Accept: 'application/json' },
          method: 'GET',
          signal: controller.signal,
        });
        if (!response.ok) return unhealthy('network');

        const parsed = HealthResponseSchema.safeParse((await response.json()) as unknown);
        return parsed.success
          ? { kind: 'healthy', response: parsed.data }
          : unhealthy('invalid_response');
      } catch {
        return unhealthy(controller.signal.aborted ? 'timeout' : 'network');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

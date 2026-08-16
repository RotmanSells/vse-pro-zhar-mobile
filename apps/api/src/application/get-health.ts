import {
  type HealthErrorResponse,
  type HealthResponse,
  type RateLimitErrorResponse,
} from '@vse-pro-zhar/contracts';

import { HEALTH_SERVICE_NAME, type HealthClock, type HealthReadiness } from '../domain/health';

export type HealthResult =
  | { readonly status: 200; readonly body: HealthResponse }
  | { readonly status: 503; readonly body: HealthErrorResponse }
  | { readonly status: 429; readonly body: RateLimitErrorResponse };

export function getHealth(
  readiness: HealthReadiness,
  clock: HealthClock,
  version: string,
  rateLimited: boolean,
): HealthResult {
  const timestamp = clock.now().toISOString();
  if (rateLimited) {
    return {
      status: 429,
      body: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        service: HEALTH_SERVICE_NAME,
        timestamp,
      },
    };
  }
  if (!readiness.isReady()) {
    return {
      status: 503,
      body: {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
        service: HEALTH_SERVICE_NAME,
        timestamp,
      },
    };
  }
  return {
    status: 200,
    body: { status: 'ok', service: HEALTH_SERVICE_NAME, version, timestamp },
  };
}

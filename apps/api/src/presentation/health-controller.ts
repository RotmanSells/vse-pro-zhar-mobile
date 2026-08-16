import type { ServerResponse } from 'node:http';

import { getHealth } from '../application/get-health';
import type { HealthClock, HealthReadiness } from '../domain/health';
import type { SourceRateLimiter } from '../infrastructure/source-rate-limiter';

interface HealthControllerDependencies {
  readonly clock: HealthClock;
  readonly readiness: HealthReadiness;
  readonly rateLimiter: SourceRateLimiter;
  readonly version: string;
}

export function writeHealthResponse(
  response: ServerResponse,
  sourceIp: string,
  dependencies: HealthControllerDependencies,
): void {
  const rateLimit = dependencies.rateLimiter.consume(sourceIp);
  const result = getHealth(
    dependencies.readiness,
    dependencies.clock,
    dependencies.version,
    rateLimit.limited,
  );
  const headers: Record<string, string | number> = { 'Cache-Control': 'no-store' };
  if (result.status === 429) {
    headers['RateLimit-Limit'] = '60';
    headers['RateLimit-Remaining'] = '0';
    headers['Retry-After'] = String(rateLimit.retryAfterSeconds);
  }
  response.writeHead(result.status, headers);
  response.end(JSON.stringify(result.body));
}

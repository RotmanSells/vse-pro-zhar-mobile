import {
  HEALTH_SERVICE_NAME,
  HealthResponseSchema,
  type HealthResponse,
} from '@vse-pro-zhar/contracts';

export function buildHealthResponse(
  version: string,
  now: () => Date = () => new Date(),
): HealthResponse {
  return HealthResponseSchema.parse({
    service: HEALTH_SERVICE_NAME,
    status: 'ok',
    timestamp: now().toISOString(),
    version,
  });
}

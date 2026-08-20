import type { HealthResponse } from '@vse-pro-zhar/contracts';

export type HealthCheckFailureReason = 'configuration' | 'invalid_response' | 'network' | 'timeout';

export type HealthCheckResult =
  | { readonly kind: 'healthy'; readonly response: HealthResponse }
  | { readonly kind: 'unhealthy'; readonly reason: HealthCheckFailureReason };

export interface HealthCheckPort {
  check(): Promise<HealthCheckResult>;
}

export function checkApiHealth(port: HealthCheckPort): Promise<HealthCheckResult> {
  return port.check();
}

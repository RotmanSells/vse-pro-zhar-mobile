import type { HealthResponse } from '@vse-pro-zhar/contracts';

export type MobileHealthState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'healthy'; readonly response: HealthResponse }
  | { readonly kind: 'unavailable' };

export interface HealthClient {
  getHealth(): Promise<HealthResponse>;
}

export async function getMobileHealthState(client: HealthClient): Promise<MobileHealthState> {
  try {
    return { kind: 'healthy', response: await client.getHealth() };
  } catch {
    return { kind: 'unavailable' };
  }
}

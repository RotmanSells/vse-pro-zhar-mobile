import { HealthResponseSchema, type HealthResponse } from '@vse-pro-zhar/contracts';

import type { HealthClient } from '../application/get-health-state';

const REQUEST_TIMEOUT_MILLISECONDS = 5_000;

function healthUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS');
  }
  return new URL('/health', url).toString();
}

export class HttpHealthClient implements HealthClient {
  public constructor(private readonly baseUrl: string) {}

  public async getHealth(): Promise<HealthResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
    try {
      const response = await fetch(healthUrl(this.baseUrl), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = (await response.json()) as unknown;
      if (response.status !== 200) throw new Error(`Health endpoint returned ${response.status}`);
      return HealthResponseSchema.parse(payload);
    } finally {
      clearTimeout(timeout);
    }
  }
}

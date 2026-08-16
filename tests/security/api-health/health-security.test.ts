import type { AddressInfo } from 'node:net';

import { createApiServer } from '../../../apps/api/src/composition/create-api-server';
import type { HealthReadiness } from '../../../apps/api/src/domain/health';
import { InMemorySourceRateLimiter } from '../../../apps/api/src/infrastructure/source-rate-limiter';
import {
  HealthErrorResponseSchema,
  RateLimitErrorResponseSchema,
} from '../../../packages/contracts/src';

describe('health endpoint security policy', () => {
  it('permits unauthenticated reads and sends only safe unavailable output', async () => {
    const readiness: HealthReadiness = { isReady: () => false };
    const server = createApiServer({ readiness });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
        headers: { Authorization: 'Bearer should-not-be-logged' },
      });
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = HealthErrorResponseSchema.parse(JSON.parse(await response.text()) as unknown);
      expect(body.error).toEqual({ code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' });
      expect(body.service).toBe('vse-pro-zhar-api');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });

  it('returns the documented rate-limit response and headers', async () => {
    const limiter = new InMemorySourceRateLimiter(1, 60_000);
    const server = createApiServer({ rateLimiter: limiter });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    try {
      await fetch(`http://127.0.0.1:${address.port}/health`);
      const limited = await fetch(`http://127.0.0.1:${address.port}/health`);
      expect(limited.status).toBe(429);
      expect(limited.headers.get('cache-control')).toBe('no-store');
      expect(limited.headers.get('ratelimit-limit')).toBe('60');
      expect(limited.headers.get('ratelimit-remaining')).toBe('0');
      expect(limited.headers.get('retry-after')).toBe('60');
      const body = RateLimitErrorResponseSchema.parse(JSON.parse(await limited.text()) as unknown);
      expect(body.error).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests' });
      expect(body.service).toBe('vse-pro-zhar-api');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });
});

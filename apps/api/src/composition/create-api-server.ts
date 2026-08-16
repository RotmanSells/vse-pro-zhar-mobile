import { createServer, type IncomingMessage, type Server } from 'node:http';

import type { HealthClock, HealthReadiness } from '../domain/health';
import { SystemClock } from '../infrastructure/fixed-clock';
import {
  InMemorySourceRateLimiter,
  type SourceRateLimiter,
} from '../infrastructure/source-rate-limiter';
import { RuntimeReadiness } from '../infrastructure/runtime-readiness';
import { writeHealthResponse } from '../presentation/health-controller';

export interface ApiServerOptions {
  readonly clock?: HealthClock;
  readonly readiness?: HealthReadiness;
  readonly rateLimiter?: SourceRateLimiter;
  readonly version?: string;
}

function sourceIp(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? 'unknown';
}

export function createApiServer(options: ApiServerOptions = {}): Server {
  const dependencies = {
    clock: options.clock ?? new SystemClock(),
    readiness: options.readiness ?? new RuntimeReadiness(),
    rateLimiter: options.rateLimiter ?? new InMemorySourceRateLimiter(60, 60_000),
    version: options.version ?? '0.1.0',
  };
  return createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://api.local').pathname;
    if (request.method === 'GET' && path === '/health') {
      writeHealthResponse(response, sourceIp(request), dependencies);
      return;
    }
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end();
  });
}

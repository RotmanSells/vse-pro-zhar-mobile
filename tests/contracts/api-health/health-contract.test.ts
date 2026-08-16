import {
  HealthErrorResponseSchema,
  HealthResponseSchema,
  RateLimitErrorResponseSchema,
  parseHealthResponse,
} from '../../../packages/contracts/src';

const timestamp = '2026-08-16T12:00:00.000Z';

describe('health runtime contract', () => {
  it('accepts all OpenAPI health payload variants', () => {
    expect(
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'vse-pro-zhar-api',
        version: '0.1.0',
        timestamp,
      }),
    ).toBeDefined();
    expect(
      HealthErrorResponseSchema.parse({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
        service: 'vse-pro-zhar-api',
        timestamp,
      }),
    ).toBeDefined();
    expect(
      RateLimitErrorResponseSchema.parse({
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        service: 'vse-pro-zhar-api',
        timestamp,
      }),
    ).toBeDefined();
  });

  it('rejects unchecked health payloads', () => {
    expect(() => parseHealthResponse(200, { status: 'ok' })).toThrow();
    expect(() => parseHealthResponse(500, {})).toThrow('Unexpected health response status');
  });
});

import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('vse-pro-zhar-api'),
    version: z.string().min(1),
    timestamp,
  })
  .strict();

export const HealthErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.literal('SERVICE_UNAVAILABLE'),
        message: z.literal('Service unavailable'),
      })
      .strict(),
    service: z.literal('vse-pro-zhar-api'),
    timestamp,
  })
  .strict();

export const RateLimitErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.literal('RATE_LIMITED'),
        message: z.literal('Too many requests'),
      })
      .strict(),
    service: z.literal('vse-pro-zhar-api'),
    timestamp,
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type HealthErrorResponse = z.infer<typeof HealthErrorResponseSchema>;
export type RateLimitErrorResponse = z.infer<typeof RateLimitErrorResponseSchema>;

export function parseHealthResponse(status: number, payload: unknown) {
  if (status === 200) return HealthResponseSchema.parse(payload);
  if (status === 503) return HealthErrorResponseSchema.parse(payload);
  if (status === 429) return RateLimitErrorResponseSchema.parse(payload);
  throw new Error(`Unexpected health response status: ${status}`);
}

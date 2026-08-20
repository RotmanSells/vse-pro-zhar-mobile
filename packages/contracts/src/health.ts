import { z } from 'zod';

export const HEALTH_SERVICE_NAME = 'vse-pro-zhar-api';

const API_ERROR_CODES = ['INTERNAL_SERVER_ERROR', 'METHOD_NOT_ALLOWED', 'NOT_FOUND'] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const HealthResponseSchema = z
  .object({
    service: z.literal(HEALTH_SERVICE_NAME),
    status: z.literal('ok'),
    timestamp: z.iso.datetime({ offset: true }),
    version: z.string().trim().min(1),
  })
  .strict();

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.enum(API_ERROR_CODES),
        message: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export function parseHealthResponse(payload: unknown): HealthResponse {
  return HealthResponseSchema.parse(payload);
}

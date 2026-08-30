import { z } from 'zod';

export const HEALTH_SERVICE_NAME = 'vse-pro-zhar-api';

const API_ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'CONFLICT',
  'FORBIDDEN',
  'INTERNAL_SERVER_ERROR',
  'INVALID_IMAGE',
  'INVALID_REQUEST',
  'METHOD_NOT_ALLOWED',
  'LEGACY_ENDPOINT_DISABLED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'STORAGE_UNAVAILABLE',
  'UNSUPPORTED_MEDIA_TYPE',
] as const;

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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { z } from 'zod';

const HealthDocumentShape = z.object({
  components: z.object({
    schemas: z.object({
      ApiErrorResponse: z.unknown(),
      HealthResponse: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([
          z.literal('status'),
          z.literal('service'),
          z.literal('version'),
          z.literal('timestamp'),
        ]),
      }),
    }),
  }),
  openapi: z.literal('3.1.0'),
  paths: z.object({
    '/health': z.object({
      get: z.object({
        operationId: z.literal('getHealth'),
        responses: z.object({
          '200': z.object({
            content: z.object({
              'application/json': z.object({
                schema: z.object({
                  $ref: z.literal('#/components/schemas/HealthResponse'),
                }),
              }),
            }),
          }),
          '405': z.object({
            content: z.object({
              'application/json': z.object({
                schema: z.object({
                  $ref: z.literal('#/components/schemas/ApiErrorResponse'),
                }),
              }),
            }),
          }),
          '500': z.object({
            content: z.object({
              'application/json': z.object({
                schema: z.object({
                  $ref: z.literal('#/components/schemas/ApiErrorResponse'),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
});
await test('OpenAPI document describes the real health and safe error contract', () => {
  const source = readFileSync(
    new URL('../../openapi/health.openapi.json', import.meta.url),
    'utf8',
  );
  const raw: unknown = JSON.parse(source);

  const document = HealthDocumentShape.parse(raw);

  assert.equal(document.openapi, '3.1.0');
  assert.equal(document.paths['/health'].get.operationId, 'getHealth');
  assert.equal(
    document.paths['/health'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/HealthResponse',
  );
  assert.equal(
    document.paths['/health'].get.responses['405'].content['application/json'].schema.$ref,
    '#/components/schemas/ApiErrorResponse',
  );
  assert.equal(
    document.paths['/health'].get.responses['500'].content['application/json'].schema.$ref,
    '#/components/schemas/ApiErrorResponse',
  );
  assert.deepEqual(document.components.schemas.HealthResponse.required, [
    'status',
    'service',
    'version',
    'timestamp',
  ]);
});

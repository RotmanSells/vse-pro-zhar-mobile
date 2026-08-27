import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { z } from 'zod';

const HealthDocumentShape = z.object({
  components: z.object({
    parameters: z.object({
      DevelopmentIdentity: z.object({
        in: z.literal('header'),
        name: z.literal('X-VPZH-Development-Identity'),
        required: z.literal(true),
      }),
      DevelopmentAdminIdentity: z.object({
        in: z.literal('header'),
        name: z.literal('X-VPZH-Development-Admin-Identity'),
        required: z.literal(true),
      }),
    }),
    schemas: z.object({
      ApiErrorResponse: z.unknown(),
      CategoryResponse: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([z.literal('id'), z.literal('name')]),
      }),
      CategoryListResponse: z.object({
        type: z.literal('array'),
      }),
      ProductResponse: z.object({
        additionalProperties: z.literal(false),
        required: z.array(z.string()),
      }),
      ProductDetailsResponse: z.object({
        allOf: z.array(z.unknown()),
      }),
      UpdateProductDetailsRequest: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([
          z.literal('description'),
          z.literal('weightGrams'),
          z.literal('isNew'),
          z.literal('isHit'),
        ]),
      }),
      CreateCategoryRequest: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([z.literal('name')]),
      }),
      CustomerProfilePatchRequest: z.object({
        additionalProperties: z.literal(false),
        minProperties: z.literal(1),
      }),
      CustomerProfileResponse: z.object({
        additionalProperties: z.literal(false),
        required: z.array(z.string()),
      }),
      LegalAcceptanceResponse: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([z.literal('documents'), z.literal('mode')]),
      }),
      RecordLegalAcceptanceRequest: z.object({
        additionalProperties: z.literal(false),
        required: z.tuple([z.literal('documentType')]),
      }),
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
    '/admin/categories': z.object({
      post: z.object({
        operationId: z.literal('createCategory'),
      }),
    }),
    '/categories': z.object({
      get: z.object({
        operationId: z.literal('listCategories'),
      }),
    }),
    '/admin/products/{productId}/details': z.object({
      patch: z.object({ operationId: z.literal('updateProductDetails') }),
    }),
    '/products/{productId}': z.object({
      get: z.object({ operationId: z.literal('getProductDetails') }),
    }),
    '/me/profile': z.object({
      get: z.object({
        operationId: z.literal('getCurrentCustomerProfile'),
      }),
      patch: z.object({
        operationId: z.literal('updateCurrentCustomerProfile'),
      }),
    }),
    '/me/legal-acceptances': z.object({
      get: z.object({
        operationId: z.literal('getCurrentLegalAcceptances'),
      }),
      post: z.object({
        operationId: z.literal('recordCurrentLegalAcceptance'),
        requestBody: z.object({
          content: z.object({
            'application/json': z.object({
              schema: z.object({
                $ref: z.literal('#/components/schemas/RecordLegalAcceptanceRequest'),
              }),
            }),
          }),
          required: z.literal(true),
        }),
      }),
    }),
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
  assert.equal(document.paths['/admin/categories'].post.operationId, 'createCategory');
  assert.equal(document.paths['/categories'].get.operationId, 'listCategories');
  assert.equal(
    document.paths['/admin/products/{productId}/details'].patch.operationId,
    'updateProductDetails',
  );
  assert.equal(document.paths['/products/{productId}'].get.operationId, 'getProductDetails');
  assert.deepEqual(document.components.schemas.ProductResponse.required, [
    'id',
    'categoryId',
    'name',
    'basePriceMinor',
    'adminEnabled',
    'description',
    'weightGrams',
    'isNew',
    'isHit',
  ]);
  assert.deepEqual(document.components.schemas.UpdateProductDetailsRequest.required, [
    'description',
    'weightGrams',
    'isNew',
    'isHit',
  ]);
  assert.deepEqual(document.components.schemas.CategoryResponse.required, ['id', 'name']);
  assert.deepEqual(document.components.schemas.CreateCategoryRequest.required, ['name']);
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
  assert.equal(document.paths['/me/profile'].get.operationId, 'getCurrentCustomerProfile');
  assert.equal(document.paths['/me/profile'].patch.operationId, 'updateCurrentCustomerProfile');
  assert.deepEqual(document.components.schemas.CustomerProfileResponse.required, [
    'customerId',
    'phone',
    'name',
    'birthday',
    'createdAt',
    'updatedAt',
  ]);
  assert.equal(
    document.paths['/me/legal-acceptances'].get.operationId,
    'getCurrentLegalAcceptances',
  );
  assert.equal(
    document.paths['/me/legal-acceptances'].post.operationId,
    'recordCurrentLegalAcceptance',
  );
  assert.deepEqual(document.components.schemas.LegalAcceptanceResponse.required, [
    'documents',
    'mode',
  ]);
  assert.deepEqual(document.components.schemas.RecordLegalAcceptanceRequest.required, [
    'documentType',
  ]);
});

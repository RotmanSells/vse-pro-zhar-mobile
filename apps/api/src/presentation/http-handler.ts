import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ApiErrorResponseSchema,
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CreateCategoryRequestSchema,
  CustomerProfilePatchRequestSchema,
  CustomerProfileResponseSchema,
  LegalAcceptanceResponseSchema,
  RecordLegalAcceptanceRequestSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from '@vse-pro-zhar/contracts';

import {
  createCategory,
  listCategories,
  CategoryAuthorizationError,
  type CategoryRepository,
} from '../application/catalog/category.ts';
import type { AdminIdentityResolver } from '../application/admin-authorization.ts';
import {
  getCurrentCustomerProfile,
  updateCurrentCustomerProfile,
  type CustomerProfileRepository,
  type CustomerProfileUpdate,
  type DevelopmentIdentityResolver,
} from '../application/customer-profile.ts';
import {
  getCurrentLegalAcceptances,
  recordCurrentLegalAcceptance,
  type LegalAcceptanceRepository,
} from '../application/legal-acceptance.ts';

import { buildHealthResponse } from './health-response.ts';

const HEALTH_PATH = '/health';
const ADMIN_CATEGORIES_PATH = '/admin/categories';
const CATEGORIES_PATH = '/categories';
const CUSTOMER_PROFILE_PATH = '/me/profile';
const LEGAL_ACCEPTANCES_PATH = '/me/legal-acceptances';
export const DEVELOPMENT_IDENTITY_HEADER = 'x-vpzh-development-identity';
export const DEVELOPMENT_ADMIN_IDENTITY_HEADER = 'x-vpzh-development-admin-identity';
const MAX_JSON_BODY_BYTES = 16_384;

const ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  FORBIDDEN: 'Forbidden',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_REQUEST: 'Invalid request',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  NOT_FOUND: 'Not found',
};

export interface RequestHandlerDependencies {
  readonly now: () => Date;
  readonly version: string;
  readonly identityResolver: DevelopmentIdentityResolver | undefined;
  readonly legalAcceptanceRepository: LegalAcceptanceRepository | undefined;
  readonly customerProfileRepository: CustomerProfileRepository | undefined;
  readonly categoryRepository: CategoryRepository | undefined;
  readonly adminIdentityResolver: AdminIdentityResolver | undefined;
}

function buildErrorResponse(code: ApiErrorCode): ApiErrorResponse {
  return ApiErrorResponseSchema.parse({
    error: {
      code,
      message: ERROR_MESSAGES[code],
    },
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

class InvalidJsonRequestError extends Error {}

async function readJsonRequestBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'];
  if (
    typeof contentType !== 'string' ||
    contentType.split(';', 1)[0]?.trim() !== 'application/json'
  ) {
    throw new InvalidJsonRequestError('Request must use application/json');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const rawChunk of request as AsyncIterable<unknown>) {
    if (typeof rawChunk !== 'string' && !Buffer.isBuffer(rawChunk)) {
      throw new InvalidJsonRequestError('Request body is not readable');
    }
    const buffer = typeof rawChunk === 'string' ? Buffer.from(rawChunk) : rawChunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new InvalidJsonRequestError('Request body is too large');
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new InvalidJsonRequestError('Request body is not valid JSON');
  }
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://api.local');
  if (requestUrl.pathname === HEALTH_PATH) {
    if (request.method !== 'GET') {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
        Allow: 'GET',
      });
      return;
    }

    sendJson(response, 200, buildHealthResponse(dependencies.version, dependencies.now));
    return;
  }

  if (requestUrl.pathname === ADMIN_CATEGORIES_PATH || requestUrl.pathname === CATEGORIES_PATH) {
    const isAdminCreateRequest = requestUrl.pathname === ADMIN_CATEGORIES_PATH;
    const allowedMethods = isAdminCreateRequest ? ['POST'] : ['GET'];
    if (request.method === undefined || !allowedMethods.includes(request.method)) {
      sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
        Allow: allowedMethods.join(', '),
      });
      return;
    }

    const repository = dependencies.categoryRepository;
    if (repository === undefined) throw new Error('Category repository is not configured');

    if (!isAdminCreateRequest) {
      const categories = await listCategories(repository);
      sendJson(response, 200, CategoryListResponseSchema.parse(categories));
      return;
    }

    const principal = dependencies.adminIdentityResolver?.resolve({
      rawHeader: request.headers[DEVELOPMENT_ADMIN_IDENTITY_HEADER],
    });
    if (principal === undefined) {
      sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
      return;
    }

    let body: unknown;
    try {
      body = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }

    const parsedBody = CreateCategoryRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }

    try {
      const category = await createCategory(principal, parsedBody.data, repository);
      sendJson(response, 201, CategoryResponseSchema.parse(category));
    } catch (error) {
      if (error instanceof CategoryAuthorizationError) {
        sendJson(response, 403, buildErrorResponse('FORBIDDEN'));
        return;
      }
      throw error;
    }
    return;
  }

  if (
    requestUrl.pathname !== CUSTOMER_PROFILE_PATH &&
    requestUrl.pathname !== LEGAL_ACCEPTANCES_PATH
  ) {
    sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
    return;
  }

  const isProfileRequest = requestUrl.pathname === CUSTOMER_PROFILE_PATH;
  const allowedMethods = isProfileRequest ? ['GET', 'PATCH'] : ['GET', 'POST'];
  if (request.method === undefined || !allowedMethods.includes(request.method)) {
    sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
      Allow: allowedMethods.join(', '),
    });
    return;
  }

  const identity = dependencies.identityResolver?.resolve({
    rawHeader: request.headers[DEVELOPMENT_IDENTITY_HEADER],
  });
  if (identity === undefined) {
    sendJson(response, 401, buildErrorResponse('AUTHENTICATION_REQUIRED'));
    return;
  }

  const repository = dependencies.customerProfileRepository;
  if (repository === undefined) throw new Error('Customer profile repository is not configured');

  if (!isProfileRequest) {
    const legalAcceptanceRepository = dependencies.legalAcceptanceRepository;
    if (legalAcceptanceRepository === undefined) {
      throw new Error('Legal acceptance repository is not configured');
    }

    if (request.method === 'GET') {
      const legalAcceptances = await getCurrentLegalAcceptances(
        identity,
        repository,
        legalAcceptanceRepository,
      );
      sendJson(response, 200, LegalAcceptanceResponseSchema.parse(legalAcceptances));
      return;
    }

    let legalBody: unknown;
    try {
      legalBody = await readJsonRequestBody(request);
    } catch (error) {
      if (error instanceof InvalidJsonRequestError) {
        sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
        return;
      }
      throw error;
    }
    const parsedLegalBody = RecordLegalAcceptanceRequestSchema.safeParse(legalBody);
    if (!parsedLegalBody.success) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    const legalAcceptances = await recordCurrentLegalAcceptance(
      identity,
      parsedLegalBody.data.documentType,
      repository,
      legalAcceptanceRepository,
    );
    sendJson(response, 200, LegalAcceptanceResponseSchema.parse(legalAcceptances));
    return;
  }

  if (request.method === 'GET') {
    const profile = await getCurrentCustomerProfile(identity, repository);
    sendJson(response, 200, CustomerProfileResponseSchema.parse(profile));
    return;
  }

  let body: unknown;
  try {
    body = await readJsonRequestBody(request);
  } catch (error) {
    if (error instanceof InvalidJsonRequestError) {
      sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
      return;
    }
    throw error;
  }

  const parsedBody = CustomerProfilePatchRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    sendJson(response, 400, buildErrorResponse('INVALID_REQUEST'));
    return;
  }

  const changes: CustomerProfileUpdate = {
    ...(parsedBody.data.name === undefined ? {} : { name: parsedBody.data.name }),
    ...(parsedBody.data.birthday === undefined ? {} : { birthday: parsedBody.data.birthday }),
  };

  const profile = await updateCurrentCustomerProfile(identity, changes, repository);
  sendJson(response, 200, CustomerProfileResponseSchema.parse(profile));
}

export function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): void {
  void routeRequest(request, response, dependencies).catch(() => {
    console.error('request_handler_failed: unexpected_http_handler_error');
    if (!response.headersSent) sendJson(response, 500, buildErrorResponse('INTERNAL_SERVER_ERROR'));
    else response.destroy();
  });
}

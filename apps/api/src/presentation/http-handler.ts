import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ApiErrorResponseSchema,
  CustomerProfilePatchRequestSchema,
  CustomerProfileResponseSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from '@vse-pro-zhar/contracts';

import {
  getCurrentCustomerProfile,
  updateCurrentCustomerProfile,
  type CustomerProfileRepository,
  type CustomerProfileUpdate,
  type DevelopmentIdentityResolver,
} from '../application/customer-profile.ts';

import { buildHealthResponse } from './health-response.ts';

const HEALTH_PATH = '/health';
const CUSTOMER_PROFILE_PATH = '/me/profile';
export const DEVELOPMENT_IDENTITY_HEADER = 'x-vpzh-development-identity';
const MAX_PROFILE_BODY_BYTES = 16_384;

const ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_REQUEST: 'Invalid request',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  NOT_FOUND: 'Not found',
};

export interface RequestHandlerDependencies {
  readonly now: () => Date;
  readonly version: string;
  readonly identityResolver: DevelopmentIdentityResolver | undefined;
  readonly customerProfileRepository: CustomerProfileRepository | undefined;
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

class InvalidProfileRequestError extends Error {}

async function readProfileRequestBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'];
  if (
    typeof contentType !== 'string' ||
    contentType.split(';', 1)[0]?.trim() !== 'application/json'
  ) {
    throw new InvalidProfileRequestError('Profile request must use application/json');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const rawChunk of request as AsyncIterable<unknown>) {
    if (typeof rawChunk !== 'string' && !Buffer.isBuffer(rawChunk)) {
      throw new InvalidProfileRequestError('Profile request body is not readable');
    }
    const buffer = typeof rawChunk === 'string' ? Buffer.from(rawChunk) : rawChunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_PROFILE_BODY_BYTES) {
      throw new InvalidProfileRequestError('Profile request body is too large');
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new InvalidProfileRequestError('Profile request body is not valid JSON');
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

  if (requestUrl.pathname !== CUSTOMER_PROFILE_PATH) {
    sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
    return;
  }

  if (request.method !== 'GET' && request.method !== 'PATCH') {
    sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
      Allow: 'GET, PATCH',
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

  if (request.method === 'GET') {
    const profile = await getCurrentCustomerProfile(identity, repository);
    sendJson(response, 200, CustomerProfileResponseSchema.parse(profile));
    return;
  }

  let body: unknown;
  try {
    body = await readProfileRequestBody(request);
  } catch (error) {
    if (error instanceof InvalidProfileRequestError) {
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

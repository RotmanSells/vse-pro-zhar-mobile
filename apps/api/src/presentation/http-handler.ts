import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ApiErrorResponseSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from '@vse-pro-zhar/contracts';

import { buildHealthResponse } from './health-response.ts';

const HEALTH_PATH = '/health';

const ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  NOT_FOUND: 'Not found',
};

export interface RequestHandlerDependencies {
  readonly now: () => Date;
  readonly version: string;
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

function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): void {
  const requestUrl = new URL(request.url ?? '/', 'http://api.local');
  if (requestUrl.pathname !== HEALTH_PATH) {
    sendJson(response, 404, buildErrorResponse('NOT_FOUND'));
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, buildErrorResponse('METHOD_NOT_ALLOWED'), {
      Allow: 'GET',
    });
    return;
  }

  sendJson(response, 200, buildHealthResponse(dependencies.version, dependencies.now));
}

export function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RequestHandlerDependencies,
): void {
  try {
    routeRequest(request, response, dependencies);
  } catch {
    console.error('request_handler_failed: unexpected_http_handler_error');
    sendJson(response, 500, buildErrorResponse('INTERNAL_SERVER_ERROR'));
  }
}

import { createServer, type Server } from 'node:http';

import { handleRequest } from '../presentation/http-handler.ts';

export interface CreateApiServerOptions {
  readonly now?: () => Date;
  readonly version?: string;
}

export function createApiServer(options: CreateApiServerOptions = {}): Server {
  const dependencies = {
    now: options.now ?? (() => new Date()),
    version: options.version ?? '0.1.0',
  };

  return createServer((request, response) => {
    handleRequest(request, response, dependencies);
  });
}

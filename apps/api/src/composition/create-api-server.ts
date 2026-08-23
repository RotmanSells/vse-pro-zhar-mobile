import { createServer, type Server } from 'node:http';

import type {
  CustomerProfileRepository,
  DevelopmentIdentityResolver,
} from '../application/customer-profile.ts';
import { handleRequest } from '../presentation/http-handler.ts';

export interface CreateApiServerOptions {
  readonly now?: () => Date;
  readonly version?: string;
  readonly identityResolver?: DevelopmentIdentityResolver;
  readonly customerProfileRepository?: CustomerProfileRepository;
}

export function createApiServer(options: CreateApiServerOptions = {}): Server {
  const dependencies = {
    now: options.now ?? (() => new Date()),
    version: options.version ?? '0.1.0',
    identityResolver: options.identityResolver,
    customerProfileRepository: options.customerProfileRepository,
  };

  return createServer((request, response) => {
    handleRequest(request, response, dependencies);
  });
}

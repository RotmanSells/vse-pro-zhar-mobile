import { createServer, type Server } from 'node:http';

import type {
  CustomerProfileRepository,
  DevelopmentIdentityResolver,
} from '../application/customer-profile.ts';
import type { AdminIdentityResolver } from '../application/admin-authorization.ts';
import type { CategoryRepository } from '../application/catalog/category.ts';
import type {
  ProductCategoryReferenceRepository,
  ProductRepository,
} from '../application/catalog/product.ts';
import type { LegalAcceptanceRepository } from '../application/legal-acceptance.ts';
import { handleRequest } from '../presentation/http-handler.ts';

export interface CreateApiServerOptions {
  readonly now?: () => Date;
  readonly version?: string;
  readonly identityResolver?: DevelopmentIdentityResolver;
  readonly legalAcceptanceRepository?: LegalAcceptanceRepository;
  readonly customerProfileRepository?: CustomerProfileRepository;
  readonly categoryRepository?: CategoryRepository;
  readonly adminIdentityResolver?: AdminIdentityResolver;
  readonly productRepository?: ProductRepository;
  readonly productCategoryReferenceRepository?: ProductCategoryReferenceRepository;
}

export function createApiServer(options: CreateApiServerOptions = {}): Server {
  const dependencies = {
    now: options.now ?? (() => new Date()),
    version: options.version ?? '0.1.0',
    identityResolver: options.identityResolver,
    legalAcceptanceRepository: options.legalAcceptanceRepository,
    customerProfileRepository: options.customerProfileRepository,
    categoryRepository: options.categoryRepository,
    adminIdentityResolver: options.adminIdentityResolver,
    productRepository: options.productRepository,
    productCategoryReferenceRepository: options.productCategoryReferenceRepository,
  };

  return createServer((request, response) => {
    handleRequest(request, response, dependencies);
  });
}

import { createApiServer } from './composition/create-api-server.ts';
import { createDevelopmentAdminIdentityResolver } from './infrastructure/development-admin-authorization.ts';
import { createDevelopmentIdentityResolver } from './infrastructure/development-identity-boundary.ts';
import { createPostgresCategoryRepository } from './infrastructure/postgres/category-repository.ts';
import { createPostgresProductCategoryReferenceRepository } from './infrastructure/postgres/product-category-reference-repository.ts';
import { createPostgresProductRepository } from './infrastructure/postgres/product-repository.ts';
import { createPostgresCustomerProfileRepository } from './infrastructure/postgres/customer-profile-repository.ts';
import { createPostgresLegalAcceptanceRepository } from './infrastructure/postgres/legal-acceptance-repository.ts';
import { createPostgresPool } from './infrastructure/postgres/pool.ts';
import { loadRuntimeConfig } from './infrastructure/runtime-config.ts';
import { createSharpProductImageProcessor } from './infrastructure/image-processing/sharp-product-image-processor.ts';
import { createTemporaryDirectoryObjectStorage } from './infrastructure/storage/temporary-directory-object-storage.ts';
import { createYandexS3ObjectStorage } from './infrastructure/storage/yandex-s3-object-storage.ts';
import { createImageMutationGuard } from './application/catalog/product-image.ts';
import { randomUUID } from 'node:crypto';

function main(): void {
  const config = loadRuntimeConfig();
  const pool = createPostgresPool(config.databaseUrl);
  const objectStorage =
    config.imageStorageDriver === 'temporary'
      ? createTemporaryDirectoryObjectStorage(config.imageStorageDirectory)
      : createYandexS3ObjectStorage({
          accessKeyId: config.imageStorageAccessKeyId ?? '',
          bucket: config.productImageBucket,
          endpoint: config.imageStorageEndpoint,
          maxAttempts: config.imageStorageMaxAttempts,
          region: config.imageStorageRegion,
          requestTimeoutMs: config.imageStorageRequestTimeoutMs,
          secretAccessKey: config.imageStorageSecretAccessKey ?? '',
        });
  const server = createApiServer({
    customerProfileRepository: createPostgresCustomerProfileRepository(pool),
    categoryRepository: createPostgresCategoryRepository(pool),
    productCategoryReferenceRepository: createPostgresProductCategoryReferenceRepository(pool),
    productRepository: createPostgresProductRepository(pool),
    adminIdentityResolver: createDevelopmentAdminIdentityResolver({
      enabled: config.developmentAdminIdentityEnabled,
      runtime: config.runtime,
    }),
    identityResolver: createDevelopmentIdentityResolver({
      enabled: config.developmentIdentityEnabled,
      runtime: config.runtime,
    }),
    legalAcceptanceRepository: createPostgresLegalAcceptanceRepository(pool),
    imageMutationGuard: createImageMutationGuard(),
    imageProcessor: createSharpProductImageProcessor(),
    imageRevisionGenerator: randomUUID,
    objectStorage,
    productIdGenerator: randomUUID,
    productImageWriteFrozen: config.productImageWriteFrozen,
    publicApiBaseUrl: config.publicApiBaseUrl,
  });

  server.on('error', (error) => {
    console.error(`api_server_failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    console.log(`API listening on ${config.host}:${config.port}`);
  });
}

try {
  main();
} catch {
  console.error('api_start_failed');
  process.exitCode = 1;
}

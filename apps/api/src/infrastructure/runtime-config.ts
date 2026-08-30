import { z } from 'zod';

const RuntimeEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).max(253).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  NODE_ENV: z.string().trim().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  VPZH_ENABLE_DEVELOPMENT_IDENTITY: z.string().optional(),
  VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: z.string().optional(),
  VPZH_IMAGE_STORAGE_ENDPOINT: z.string().url().optional(),
  VPZH_IMAGE_STORAGE_REGION: z.string().trim().min(1).optional(),
  VPZH_PRODUCT_IMAGE_BUCKET: z.string().trim().min(1).optional(),
  VPZH_IMAGE_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  VPZH_IMAGE_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  VPZH_IMAGE_STORAGE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(5_000).optional(),
  VPZH_IMAGE_STORAGE_MAX_ATTEMPTS: z.coerce.number().int().positive().max(3).optional(),
  VPZH_PUBLIC_API_BASE_URL: z.string().url().optional(),
  VPZH_IMAGE_STORAGE_DRIVER: z.enum(['yandex', 'temporary']).optional(),
  VPZH_IMAGE_STORAGE_DIRECTORY: z.string().trim().min(1).optional(),
  VPZH_PRODUCT_IMAGE_WRITE_FREEZE: z.string().optional(),
});

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly runtime: 'development' | 'test' | 'production';
  readonly databaseUrl: string | undefined;
  readonly developmentIdentityEnabled: boolean;
  readonly developmentAdminIdentityEnabled: boolean;
  readonly imageStorageEndpoint: string;
  readonly imageStorageRegion: string;
  readonly productImageBucket: string;
  readonly imageStorageAccessKeyId: string | undefined;
  readonly imageStorageSecretAccessKey: string | undefined;
  readonly imageStorageRequestTimeoutMs: number;
  readonly imageStorageMaxAttempts: number;
  readonly publicApiBaseUrl: string;
  readonly imageStorageDriver: 'yandex' | 'temporary';
  readonly imageStorageDirectory: string;
  readonly productImageWriteFrozen: boolean;
}

function resolveRuntime(nodeEnvironment: string | undefined): RuntimeConfig['runtime'] {
  if (nodeEnvironment === 'test') return 'test';
  if (nodeEnvironment === undefined || nodeEnvironment === 'development') return 'development';
  return 'production';
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = RuntimeEnvironmentSchema.parse(environment);
  const runtime = resolveRuntime(parsed.NODE_ENV);
  const imageStorageDriver =
    parsed.VPZH_IMAGE_STORAGE_DRIVER ?? (runtime === 'production' ? 'yandex' : 'temporary');
  const imageStorageEndpoint =
    parsed.VPZH_IMAGE_STORAGE_ENDPOINT ?? 'https://storage.yandexcloud.net';
  const publicApiBaseUrl =
    parsed.VPZH_PUBLIC_API_BASE_URL ?? `http://${parsed.HOST}:${parsed.PORT}`;
  const storageEndpoint = new URL(imageStorageEndpoint);
  const publicApiUrl = new URL(publicApiBaseUrl);
  if (
    !['http:', 'https:'].includes(storageEndpoint.protocol) ||
    storageEndpoint.username !== '' ||
    storageEndpoint.password !== '' ||
    storageEndpoint.pathname !== '/' ||
    storageEndpoint.search !== '' ||
    storageEndpoint.hash !== ''
  ) {
    throw new Error('Image storage endpoint must be an origin without credentials');
  }
  if (
    !['http:', 'https:'].includes(publicApiUrl.protocol) ||
    publicApiUrl.username !== '' ||
    publicApiUrl.password !== '' ||
    publicApiUrl.pathname !== '/' ||
    publicApiUrl.search !== '' ||
    publicApiUrl.hash !== ''
  ) {
    throw new Error('Public API base URL must be an origin without credentials');
  }
  if (
    imageStorageDriver === 'yandex' &&
    (parsed.VPZH_IMAGE_STORAGE_ACCESS_KEY_ID === undefined ||
      parsed.VPZH_IMAGE_STORAGE_SECRET_ACCESS_KEY === undefined)
  ) {
    throw new Error('Yandex image storage credentials must come from deployment configuration');
  }
  if (runtime === 'production') {
    if (imageStorageDriver !== 'yandex') {
      throw new Error('Production image storage must use Yandex Object Storage');
    }
    if (
      parsed.VPZH_IMAGE_STORAGE_ACCESS_KEY_ID === undefined ||
      parsed.VPZH_IMAGE_STORAGE_SECRET_ACCESS_KEY === undefined
    ) {
      throw new Error(
        'Production image storage credentials must come from deployment configuration',
      );
    }
    if (
      parsed.VPZH_PUBLIC_API_BASE_URL === undefined ||
      !parsed.VPZH_PUBLIC_API_BASE_URL.startsWith('https://')
    ) {
      throw new Error('Production public API base URL must be HTTPS and deployment-configured');
    }
  }

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    runtime,
    databaseUrl: parsed.DATABASE_URL,
    developmentIdentityEnabled:
      runtime !== 'production' && parsed.VPZH_ENABLE_DEVELOPMENT_IDENTITY === 'true',
    developmentAdminIdentityEnabled:
      runtime !== 'production' && parsed.VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY === 'true',
    imageStorageEndpoint,
    imageStorageRegion: parsed.VPZH_IMAGE_STORAGE_REGION ?? 'ru-central1',
    productImageBucket:
      parsed.VPZH_PRODUCT_IMAGE_BUCKET ??
      (runtime === 'production'
        ? 'vse-pro-zhar-product-images-prod'
        : 'vse-pro-zhar-product-images-dev'),
    imageStorageAccessKeyId: parsed.VPZH_IMAGE_STORAGE_ACCESS_KEY_ID,
    imageStorageSecretAccessKey: parsed.VPZH_IMAGE_STORAGE_SECRET_ACCESS_KEY,
    imageStorageRequestTimeoutMs: parsed.VPZH_IMAGE_STORAGE_REQUEST_TIMEOUT_MS ?? 5_000,
    imageStorageMaxAttempts: parsed.VPZH_IMAGE_STORAGE_MAX_ATTEMPTS ?? 3,
    publicApiBaseUrl,
    imageStorageDriver,
    imageStorageDirectory: parsed.VPZH_IMAGE_STORAGE_DIRECTORY ?? 'artifacts/product-images',
    productImageWriteFrozen: parsed.VPZH_PRODUCT_IMAGE_WRITE_FREEZE === 'true',
  };
}

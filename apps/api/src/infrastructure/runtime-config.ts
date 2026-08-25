import { z } from 'zod';

const RuntimeEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).max(253).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  NODE_ENV: z.string().trim().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  VPZH_ENABLE_DEVELOPMENT_IDENTITY: z.string().optional(),
  VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: z.string().optional(),
});

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly runtime: 'development' | 'test' | 'production';
  readonly databaseUrl: string | undefined;
  readonly developmentIdentityEnabled: boolean;
  readonly developmentAdminIdentityEnabled: boolean;
}

function resolveRuntime(nodeEnvironment: string | undefined): RuntimeConfig['runtime'] {
  if (nodeEnvironment === 'test') return 'test';
  if (nodeEnvironment === undefined || nodeEnvironment === 'development') return 'development';
  return 'production';
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = RuntimeEnvironmentSchema.parse(environment);
  const runtime = resolveRuntime(parsed.NODE_ENV);

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    runtime,
    databaseUrl: parsed.DATABASE_URL,
    developmentIdentityEnabled:
      runtime !== 'production' && parsed.VPZH_ENABLE_DEVELOPMENT_IDENTITY === 'true',
    developmentAdminIdentityEnabled:
      runtime !== 'production' && parsed.VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY === 'true',
  };
}

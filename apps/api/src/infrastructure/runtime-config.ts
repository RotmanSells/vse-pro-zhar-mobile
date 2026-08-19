import { z } from 'zod';

const RuntimeEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).max(253).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export interface RuntimeConfig {
  readonly host: string;
  readonly port: number;
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = RuntimeEnvironmentSchema.parse(environment);

  return {
    host: parsed.HOST,
    port: parsed.PORT,
  };
}

import Constants from 'expo-constants';

export type DevelopmentIdentityRuntime = 'development' | 'test' | 'production';

interface ExpoConfigLike {
  readonly extra?: {
    readonly devIdentityBypass?: unknown;
  };
}

export interface DevelopmentIdentityConfig {
  readonly enabled: boolean;
  readonly runtime: DevelopmentIdentityRuntime;
}

function isExplicitlyEnabled(value: unknown): boolean {
  return value === 'true';
}

export function isDevelopmentIdentityBypassEnabled({
  flag,
  runtime,
}: {
  readonly flag: unknown;
  readonly runtime: DevelopmentIdentityRuntime;
}): boolean {
  return runtime !== 'production' && isExplicitlyEnabled(flag);
}

function readRuntime(): DevelopmentIdentityRuntime {
  if (!(typeof __DEV__ === 'boolean' && __DEV__)) return 'production';
  return process.env.NODE_ENV === 'test' ? 'test' : 'development';
}

export function readDevelopmentIdentityConfig(
  config: ExpoConfigLike | null | undefined = Constants.expoConfig,
): DevelopmentIdentityConfig {
  const runtime = readRuntime();

  return {
    enabled: isDevelopmentIdentityBypassEnabled({
      flag: config?.extra?.devIdentityBypass,
      runtime,
    }),
    runtime,
  };
}

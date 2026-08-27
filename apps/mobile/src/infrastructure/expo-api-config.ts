import Constants from 'expo-constants';

interface ExpoConfigLike {
  readonly extra?: {
    readonly apiBaseUrl?: unknown;
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function readApiBaseUrl(config: ExpoConfigLike | null | undefined): string | undefined {
  const value = config?.extra?.apiBaseUrl;
  if (typeof value !== 'string' || !isHttpUrl(value)) return undefined;

  return value.replace(/\/$/u, '');
}

export function readConfiguredApiBaseUrl(): string | undefined {
  return (
    readApiBaseUrl({ extra: { apiBaseUrl: process.env.EXPO_PUBLIC_API_URL } }) ??
    readApiBaseUrl(Constants.expoConfig)
  );
}

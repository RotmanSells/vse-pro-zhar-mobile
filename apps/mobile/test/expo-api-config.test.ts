import { readApiBaseUrl, readConfiguredApiBaseUrl } from '../src/infrastructure/expo-api-config.ts';

function readPublicApiUrlFromEnvironment(): string | undefined {
  const value: unknown = process.env.EXPO_PUBLIC_API_URL;
  return typeof value === 'string' ? value : undefined;
}

describe('Expo public API URL configuration', () => {
  it('accepts a configured HTTP API URL', () => {
    expect(readApiBaseUrl({ extra: { apiBaseUrl: 'http://10.0.2.2:3100/' } })).toBe(
      'http://10.0.2.2:3100',
    );
  });

  it('rejects missing and non-HTTP values', () => {
    expect(readApiBaseUrl(undefined)).toBeUndefined();
    expect(readApiBaseUrl({ extra: { apiBaseUrl: 'file:///private-api' } })).toBeUndefined();
  });

  it('prefers the current Metro-injected public API URL', () => {
    const previous = readPublicApiUrlFromEnvironment();
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:34567/';

    try {
      expect(readConfiguredApiBaseUrl()).toBe('http://10.0.2.2:34567');
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });
});

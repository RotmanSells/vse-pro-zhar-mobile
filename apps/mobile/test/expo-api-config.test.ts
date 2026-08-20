import { readApiBaseUrl } from '../src/infrastructure/expo-api-config.ts';

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
});

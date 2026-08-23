import { isDevelopmentIdentityBypassEnabled } from '../src/infrastructure/development-identity-config.ts';

describe('development identity configuration guard', () => {
  it('is disabled by default', () => {
    expect(isDevelopmentIdentityBypassEnabled({ flag: undefined, runtime: 'development' })).toBe(
      false,
    );
    expect(isDevelopmentIdentityBypassEnabled({ flag: 'false', runtime: 'test' })).toBe(false);
  });

  it('requires an explicit flag in development and test runtimes', () => {
    expect(isDevelopmentIdentityBypassEnabled({ flag: 'true', runtime: 'development' })).toBe(true);
    expect(isDevelopmentIdentityBypassEnabled({ flag: 'true', runtime: 'test' })).toBe(true);
  });

  it('fails closed in production even when the flag is accidentally enabled', () => {
    expect(isDevelopmentIdentityBypassEnabled({ flag: 'true', runtime: 'production' })).toBe(false);
  });
});

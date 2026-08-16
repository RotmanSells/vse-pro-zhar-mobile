import { InMemorySourceRateLimiter } from '../../../apps/api/src/infrastructure/source-rate-limiter';

describe('InMemorySourceRateLimiter', () => {
  it('limits requests after the configured bound and resets its window', () => {
    let now = 0;
    const limiter = new InMemorySourceRateLimiter(2, 1_000, () => now);

    expect(limiter.consume('127.0.0.1').limited).toBe(false);
    expect(limiter.consume('127.0.0.1').limited).toBe(false);
    expect(limiter.consume('127.0.0.1').limited).toBe(true);
    now = 1_000;
    expect(limiter.consume('127.0.0.1').limited).toBe(false);
  });
});

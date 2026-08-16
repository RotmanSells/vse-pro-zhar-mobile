export interface SourceRateLimiter {
  consume(source: string): { readonly limited: boolean; readonly retryAfterSeconds: number };
}

interface WindowCounter {
  readonly startedAt: number;
  count: number;
}

export class InMemorySourceRateLimiter implements SourceRateLimiter {
  private readonly counters = new Map<string, WindowCounter>();

  public constructor(
    private readonly limit: number,
    private readonly windowMilliseconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  public consume(source: string): {
    readonly limited: boolean;
    readonly retryAfterSeconds: number;
  } {
    const currentTime = this.now();
    const existing = this.counters.get(source);
    const counter =
      existing === undefined || currentTime - existing.startedAt >= this.windowMilliseconds
        ? { startedAt: currentTime, count: 0 }
        : existing;
    counter.count += 1;
    this.counters.set(source, counter);
    const remainingMilliseconds = Math.max(
      1,
      this.windowMilliseconds - (currentTime - counter.startedAt),
    );
    return {
      limited: counter.count > this.limit,
      retryAfterSeconds: Math.ceil(remainingMilliseconds / 1000),
    };
  }
}

import type { HealthClock } from '../domain/health';

export class SystemClock implements HealthClock {
  public now(): Date {
    return new Date();
  }
}

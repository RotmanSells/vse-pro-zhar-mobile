import type { HealthReadiness } from '../domain/health';

export class RuntimeReadiness implements HealthReadiness {
  public isReady(): boolean {
    return true;
  }
}

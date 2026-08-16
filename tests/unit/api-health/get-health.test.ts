import { getHealth } from '../../../apps/api/src/application/get-health';
import type { HealthClock, HealthReadiness } from '../../../apps/api/src/domain/health';

const clock: HealthClock = { now: () => new Date('2026-08-16T12:00:00.000Z') };

describe('getHealth', () => {
  it('returns the healthy contract response for ready runtime', () => {
    const readiness: HealthReadiness = { isReady: () => true };

    expect(getHealth(readiness, clock, '0.1.0', false)).toEqual({
      status: 200,
      body: {
        status: 'ok',
        service: 'vse-pro-zhar-api',
        version: '0.1.0',
        timestamp: '2026-08-16T12:00:00.000Z',
      },
    });
  });

  it('uses a safe unavailable response without readiness details', () => {
    const readiness: HealthReadiness = { isReady: () => false };

    expect(getHealth(readiness, clock, '0.1.0', false)).toEqual({
      status: 503,
      body: {
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
        service: 'vse-pro-zhar-api',
        timestamp: '2026-08-16T12:00:00.000Z',
      },
    });
  });
});

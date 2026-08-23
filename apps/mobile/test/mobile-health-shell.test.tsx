import { render } from '@testing-library/react-native';

import type { HealthCheckPort } from '../src/application/check-api-health.ts';
import type { CurrentCustomerProfilePort } from '../src/application/customer-profile.ts';
import { MobileHealthShell } from '../src/presentation/health-shell.tsx';

const profilePort: CurrentCustomerProfilePort = {
  getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
};

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      resolvePromise?.(value);
    },
  };
}

describe('MobileHealthShell', () => {
  it('shows loading, then the visible healthy operational state', async () => {
    const check = deferred<Awaited<ReturnType<HealthCheckPort['check']>>>();
    const healthCheck: HealthCheckPort = { check: () => check.promise };
    const view = await render(
      <MobileHealthShell healthCheck={healthCheck} profilePort={profilePort} />,
    );

    expect(view.getByTestId('api-health-state')).toHaveTextContent('Проверяем доступность API…');
    check.resolve({
      kind: 'healthy',
      response: {
        service: 'vse-pro-zhar-api',
        status: 'ok',
        timestamp: '2026-08-20T12:00:00.000Z',
        version: '0.1.0',
      },
    });

    expect(await view.findByText('API health: healthy')).toBeOnTheScreen();
  });

  it('shows a safe visible error state', async () => {
    const healthCheck: HealthCheckPort = {
      check: () => Promise.resolve({ kind: 'unhealthy', reason: 'network' }),
    };
    const view = await render(
      <MobileHealthShell healthCheck={healthCheck} profilePort={profilePort} />,
    );

    expect(await view.findByText('API health: unavailable')).toBeOnTheScreen();
  });
});

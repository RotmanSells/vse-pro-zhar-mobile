import { fireEvent, render } from '@testing-library/react-native';

import type { HealthCheckPort } from '../src/application/check-api-health.ts';
import type { CategoryListPort } from '../src/application/catalog/category.ts';
import type { CustomerProfilePort } from '../src/application/customer-profile.ts';
import type { LegalAcceptancePort } from '../src/application/legal-acceptance.ts';
import { MobileHealthShell } from '../src/presentation/health-shell.tsx';

const profilePort: CustomerProfilePort = {
  getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
  updateCurrentProfile: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
};

const legalAcceptancePort: LegalAcceptancePort = {
  getCurrentLegalAcceptances: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
  recordLegalAcceptance: jest.fn().mockResolvedValue({ kind: 'failure', reason: 'network' }),
};

const categoryPort: CategoryListPort = {
  listCategories: jest.fn().mockResolvedValue({ kind: 'loaded', categories: [] }),
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
      <MobileHealthShell
        healthCheck={healthCheck}
        legalAcceptancePort={legalAcceptancePort}
        profilePort={profilePort}
        categoryPort={categoryPort}
      />,
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
      <MobileHealthShell
        healthCheck={healthCheck}
        legalAcceptancePort={legalAcceptancePort}
        profilePort={profilePort}
        categoryPort={categoryPort}
      />,
    );

    expect(await view.findByText('API health: unavailable')).toBeOnTheScreen();
  });

  it('keeps the health error retryable without changing the health contract', async () => {
    const check = jest
      .fn<ReturnType<HealthCheckPort['check']>, Parameters<HealthCheckPort['check']>>()
      .mockResolvedValueOnce({ kind: 'unhealthy', reason: 'network' })
      .mockResolvedValueOnce({
        kind: 'healthy',
        response: {
          service: 'vse-pro-zhar-api',
          status: 'ok',
          timestamp: '2026-08-20T12:00:00.000Z',
          version: '0.1.0',
        },
      });
    const healthCheck: HealthCheckPort = {
      check,
    };
    const view = await render(
      <MobileHealthShell
        healthCheck={healthCheck}
        legalAcceptancePort={legalAcceptancePort}
        profilePort={profilePort}
        categoryPort={categoryPort}
      />,
    );

    expect(await view.findByTestId('api-health-retry')).toBeOnTheScreen();
    await fireEvent.press(view.getByTestId('api-health-retry'));
    expect(await view.findByTestId('api-health-healthy')).toBeOnTheScreen();
    expect(check).toHaveBeenCalledTimes(2);
  });
});

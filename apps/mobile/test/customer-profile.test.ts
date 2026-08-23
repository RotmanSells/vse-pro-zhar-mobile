import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import {
  loadDevelopmentCustomerProfile,
  type CurrentCustomerProfilePort,
} from '../src/application/customer-profile.ts';
import { createDevelopmentIdentity } from '../src/application/development-identity.ts';

const profile: CustomerProfileResponse = {
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  phone: '+7 900 000-00-00',
  name: 'Иван',
  birthday: '1990-02-03',
  createdAt: '2026-08-23T09:00:00.000Z',
  updatedAt: '2026-08-23T09:00:00.000Z',
};

describe('development customer profile application flow', () => {
  it('keeps the development identity and full backend profile on success', async () => {
    const identity = createDevelopmentIdentity('  +7 900 000-00-00  ');
    expect(identity).toBeDefined();
    const profilePort: CurrentCustomerProfilePort = {
      getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'profile', profile }),
    };

    await expect(loadDevelopmentCustomerProfile(identity!, profilePort)).resolves.toEqual({
      kind: 'connected',
      identity,
      profile,
    });
  });

  it('keeps a backend failure as an error instead of successful connection state', async () => {
    const identity = createDevelopmentIdentity('+7 900 000-00-00');
    expect(identity).toBeDefined();
    const profilePort: CurrentCustomerProfilePort = {
      getCurrentProfile: jest.fn().mockResolvedValue({
        kind: 'failure',
        reason: 'unauthorized',
      }),
    };

    const result = await loadDevelopmentCustomerProfile(identity!, profilePort);

    expect(result).toEqual({ kind: 'connection_error', identity, reason: 'unauthorized' });
    expect(result.kind).not.toBe('connected');
  });

  it('contains an unexpected adapter rejection as a stable network error', async () => {
    const identity = createDevelopmentIdentity('+7 900 000-00-00');
    expect(identity).toBeDefined();
    const profilePort: CurrentCustomerProfilePort = {
      getCurrentProfile: jest.fn().mockRejectedValue(new Error('raw adapter failure')),
    };

    await expect(loadDevelopmentCustomerProfile(identity!, profilePort)).resolves.toEqual({
      kind: 'connection_error',
      identity,
      reason: 'network',
    });
  });
});

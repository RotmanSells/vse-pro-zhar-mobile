import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import {
  loadDevelopmentCustomerProfile,
  saveDevelopmentCustomerProfile,
  type CurrentCustomerProfilePort,
  type CustomerProfilePort,
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

  it('normalizes editable fields and keeps the exact backend-returned profile on save', async () => {
    const identity = createDevelopmentIdentity('+7 900 000-00-00');
    expect(identity).toBeDefined();
    const updatedProfile: CustomerProfileResponse = {
      ...profile,
      birthday: null,
      name: 'Иван Петров',
      updatedAt: '2026-08-23T10:00:00.000Z',
    };
    const updateCurrentProfile = jest
      .fn()
      .mockResolvedValue({ kind: 'profile', profile: updatedProfile });
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn(),
      updateCurrentProfile,
    };

    await expect(
      saveDevelopmentCustomerProfile(
        identity!,
        { birthday: '   ', name: '  Иван Петров  ' },
        profilePort,
      ),
    ).resolves.toEqual({ kind: 'saved', identity, profile: updatedProfile });
    expect(updateCurrentProfile).toHaveBeenCalledWith(identity, {
      birthday: null,
      name: 'Иван Петров',
    });
  });

  it('keeps save failures explicit and never returns a saved state', async () => {
    const identity = createDevelopmentIdentity('+7 900 000-00-00');
    expect(identity).toBeDefined();
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn(),
      updateCurrentProfile: jest.fn().mockResolvedValue({
        kind: 'failure',
        reason: 'http',
      }),
    };

    const result = await saveDevelopmentCustomerProfile(
      identity!,
      { birthday: '1990-02-03', name: 'Иван' },
      profilePort,
    );

    expect(result).toEqual({ kind: 'save_error', identity, reason: 'http' });
    expect(result.kind).not.toBe('saved');
  });

  it('keeps name nullable and birthday optional when both editor fields are blank', async () => {
    const identity = createDevelopmentIdentity('+7 900 000-00-00');
    expect(identity).toBeDefined();
    const updateCurrentProfile = jest
      .fn()
      .mockResolvedValue({ kind: 'profile', profile: { ...profile, name: null, birthday: null } });
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn(),
      updateCurrentProfile,
    };

    await saveDevelopmentCustomerProfile(identity!, { birthday: ' ', name: '   ' }, profilePort);

    expect(updateCurrentProfile).toHaveBeenCalledWith(identity, {
      birthday: null,
      name: null,
    });
  });
});

import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import type { DevelopmentIdentity } from '../src/application/development-identity.ts';
import { createCustomerProfileApiClient } from '../src/infrastructure/customer-profile-api-client.ts';

const profile: CustomerProfileResponse = {
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  phone: '+7 900 000-00-00',
  name: null,
  birthday: null,
  createdAt: '2026-08-23T09:00:00.000Z',
  updatedAt: '2026-08-23T09:00:00.000Z',
};

const identity: DevelopmentIdentity = {
  kind: 'development_identity',
  phone: '  +7 900 000-00-00  ',
};

describe('customer profile API client', () => {
  it('sends the trimmed development identity to GET /me/profile and validates success', async () => {
    const fetchImpl = jest.fn((input: string, init?: RequestInit): Promise<Response> => {
      void input;
      void init;
      return Promise.resolve(new Response(JSON.stringify(profile), { status: 200 }));
    });
    const client = createCustomerProfileApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl,
    });

    await expect(client.getCurrentProfile(identity)).resolves.toEqual({
      kind: 'profile',
      profile,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.calls[0];
    expect(request?.[0]).toBe('http://10.0.2.2:3100/me/profile');
    expect(request?.[1]).toMatchObject({
      headers: {
        Accept: 'application/json',
        'X-VPZH-Development-Identity': '+7 900 000-00-00',
      },
      method: 'GET',
    });
    expect(request?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects a malformed backend profile response', async () => {
    const client = createCustomerProfileApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ customerId: profile.customerId, phone: profile.phone }), {
          status: 200,
        }),
      ),
    });

    await expect(client.getCurrentProfile(identity)).resolves.toEqual({
      kind: 'failure',
      reason: 'invalid_response',
    });
  });

  it('maps connection failures to a stable network result', async () => {
    const client = createCustomerProfileApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    });

    await expect(client.getCurrentProfile(identity)).resolves.toEqual({
      kind: 'failure',
      reason: 'network',
    });
  });

  it('maps a bounded aborted request to timeout', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createCustomerProfileApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl,
      timeoutMs: 5,
    });

    const result = client.getCurrentProfile(identity);
    await jest.advanceTimersByTimeAsync(5);
    await expect(result).resolves.toEqual({ kind: 'failure', reason: 'timeout' });
    jest.useRealTimers();
  });

  it.each([
    [401, 'unauthorized'],
    [400, 'http'],
    [404, 'http'],
    [500, 'http'],
  ] as const)('maps HTTP %s to a stable %s failure', async (status, reason) => {
    const client = createCustomerProfileApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(new Response('{}', { status })),
    });

    await expect(client.getCurrentProfile(identity)).resolves.toEqual({
      kind: 'failure',
      reason,
    });
  });

  it('fails safely when the shared API base URL is not configured', async () => {
    const client = createCustomerProfileApiClient({ apiBaseUrl: undefined });

    await expect(client.getCurrentProfile(identity)).resolves.toEqual({
      kind: 'failure',
      reason: 'configuration',
    });
  });
});

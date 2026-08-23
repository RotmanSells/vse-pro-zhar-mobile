import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import type { DevelopmentIdentity } from './development-identity.ts';

export type CustomerProfileFailureReason =
  'configuration' | 'invalid_response' | 'network' | 'timeout' | 'unauthorized' | 'http';

export type CurrentCustomerProfileResult =
  | { readonly kind: 'profile'; readonly profile: CustomerProfileResponse }
  | { readonly kind: 'failure'; readonly reason: CustomerProfileFailureReason };

export interface CurrentCustomerProfilePort {
  getCurrentProfile(identity: DevelopmentIdentity): Promise<CurrentCustomerProfileResult>;
}

export type DevelopmentCustomerProfileConnection =
  | {
      readonly kind: 'connected';
      readonly identity: DevelopmentIdentity;
      readonly profile: CustomerProfileResponse;
    }
  | {
      readonly kind: 'connection_error';
      readonly identity: DevelopmentIdentity;
      readonly reason: CustomerProfileFailureReason;
    };

export async function loadDevelopmentCustomerProfile(
  identity: DevelopmentIdentity,
  profilePort: CurrentCustomerProfilePort,
): Promise<DevelopmentCustomerProfileConnection> {
  try {
    const result = await profilePort.getCurrentProfile(identity);
    if (result.kind === 'profile') {
      return { kind: 'connected', identity, profile: result.profile };
    }

    return { kind: 'connection_error', identity, reason: result.reason };
  } catch {
    return { kind: 'connection_error', identity, reason: 'network' };
  }
}

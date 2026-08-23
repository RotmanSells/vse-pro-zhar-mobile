import type { CustomerProfilePatchRequest, CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import type { DevelopmentIdentity } from './development-identity.ts';

export type CustomerProfileFailureReason =
  | 'configuration'
  | 'invalid_request'
  | 'invalid_response'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'http';

export type CurrentCustomerProfileResult =
  | { readonly kind: 'profile'; readonly profile: CustomerProfileResponse }
  | { readonly kind: 'failure'; readonly reason: CustomerProfileFailureReason };

export interface CurrentCustomerProfilePort {
  getCurrentProfile(identity: DevelopmentIdentity): Promise<CurrentCustomerProfileResult>;
}

export interface UpdateCurrentCustomerProfilePort {
  updateCurrentProfile(
    identity: DevelopmentIdentity,
    changes: CustomerProfilePatchRequest,
  ): Promise<CurrentCustomerProfileResult>;
}

export interface CustomerProfilePort
  extends CurrentCustomerProfilePort, UpdateCurrentCustomerProfilePort {}

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

export interface CustomerProfileDraft {
  readonly name: string;
  readonly birthday: string;
}

export type DevelopmentCustomerProfileSaveResult =
  | {
      readonly kind: 'saved';
      readonly identity: DevelopmentIdentity;
      readonly profile: CustomerProfileResponse;
    }
  | {
      readonly kind: 'save_error';
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

export function profileDraftFrom(profile: CustomerProfileResponse): CustomerProfileDraft {
  return {
    birthday: profile.birthday ?? '',
    name: profile.name ?? '',
  };
}

export async function saveDevelopmentCustomerProfile(
  identity: DevelopmentIdentity,
  draft: CustomerProfileDraft,
  profilePort: UpdateCurrentCustomerProfilePort,
): Promise<DevelopmentCustomerProfileSaveResult> {
  const changes: CustomerProfilePatchRequest = {
    birthday: draft.birthday.trim() || null,
    name: draft.name.trim() || null,
  };

  try {
    const result = await profilePort.updateCurrentProfile(identity, changes);
    if (result.kind === 'profile') {
      return { kind: 'saved', identity, profile: result.profile };
    }

    return { kind: 'save_error', identity, reason: result.reason };
  } catch {
    return { kind: 'save_error', identity, reason: 'network' };
  }
}

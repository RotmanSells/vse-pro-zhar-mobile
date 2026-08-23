import type {
  CustomerProfile,
  CustomerProfileUpdate,
} from '../domain/customer/customer-profile.ts';

export type { CustomerProfileUpdate } from '../domain/customer/customer-profile.ts';

export interface DevelopmentIdentity {
  readonly kind: 'development_identity';
  readonly phone: string;
}

export interface DevelopmentIdentityResolver {
  resolve(input: { readonly rawHeader: unknown }): DevelopmentIdentity | undefined;
}

export interface CustomerProfileRepository {
  findOrCreateByPhone(phone: string): Promise<CustomerProfile>;
  updateById(customerId: string, changes: CustomerProfileUpdate): Promise<CustomerProfile>;
}

export async function getCurrentCustomerProfile(
  identity: DevelopmentIdentity,
  repository: CustomerProfileRepository,
): Promise<CustomerProfile> {
  return repository.findOrCreateByPhone(identity.phone);
}

export async function updateCurrentCustomerProfile(
  identity: DevelopmentIdentity,
  changes: CustomerProfileUpdate,
  repository: CustomerProfileRepository,
): Promise<CustomerProfile> {
  const currentProfile = await repository.findOrCreateByPhone(identity.phone);
  return repository.updateById(currentProfile.customerId, changes);
}

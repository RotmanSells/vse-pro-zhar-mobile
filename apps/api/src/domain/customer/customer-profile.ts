export interface CustomerProfile {
  readonly customerId: string;
  readonly phone: string;
  readonly name: string | null;
  readonly birthday: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerProfileUpdate {
  readonly name?: string | null;
  readonly birthday?: string | null;
}

export interface DevelopmentIdentity {
  readonly kind: 'development_identity';
  readonly phone: string;
}

export function createDevelopmentIdentity(phone: string): DevelopmentIdentity | undefined {
  const normalizedPhone = phone.trim();
  if (normalizedPhone.length === 0) return undefined;

  return {
    kind: 'development_identity',
    phone: normalizedPhone,
  };
}

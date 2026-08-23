import { z } from 'zod';

import type { DevelopmentIdentityResolver } from '../application/customer-profile.ts';

const DevelopmentPhoneHeaderSchema = z.string().trim().min(1).max(255);

export type ApiRuntime = 'development' | 'test' | 'production';

export interface DevelopmentIdentityBoundaryOptions {
  readonly enabled: boolean;
  readonly runtime: ApiRuntime;
}

export function isDevelopmentIdentityBoundaryEnabled({
  enabled,
  runtime,
}: DevelopmentIdentityBoundaryOptions): boolean {
  return enabled && runtime !== 'production';
}

export function createDevelopmentIdentityResolver(
  options: DevelopmentIdentityBoundaryOptions,
): DevelopmentIdentityResolver {
  const boundaryEnabled = isDevelopmentIdentityBoundaryEnabled(options);

  return {
    resolve({ rawHeader }) {
      if (!boundaryEnabled || typeof rawHeader !== 'string') return undefined;

      const parsedPhone = DevelopmentPhoneHeaderSchema.safeParse(rawHeader);
      if (!parsedPhone.success) return undefined;

      return {
        kind: 'development_identity',
        phone: parsedPhone.data,
      };
    },
  };
}

import { z } from 'zod';

import type { AdminIdentityResolver } from '../application/admin-authorization.ts';
import type { ApiRuntime } from './development-identity-boundary.ts';

const DevelopmentAdminHeaderSchema = z.literal('admin');

export interface DevelopmentAdminBoundaryOptions {
  readonly enabled: boolean;
  readonly runtime: ApiRuntime;
}

export function isDevelopmentAdminBoundaryEnabled({
  enabled,
  runtime,
}: DevelopmentAdminBoundaryOptions): boolean {
  return enabled && runtime !== 'production';
}

export function createDevelopmentAdminIdentityResolver(
  options: DevelopmentAdminBoundaryOptions,
): AdminIdentityResolver {
  const boundaryEnabled = isDevelopmentAdminBoundaryEnabled(options);

  return {
    resolve({ rawHeader }) {
      if (!boundaryEnabled || typeof rawHeader !== 'string') return undefined;
      if (!DevelopmentAdminHeaderSchema.safeParse(rawHeader.trim()).success) return undefined;

      return {
        kind: 'development_admin',
        subject: 'development-admin',
        role: 'admin',
      };
    },
  };
}

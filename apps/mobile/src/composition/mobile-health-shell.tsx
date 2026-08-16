import { useEffect, useMemo, useState } from 'react';

import { getMobileHealthState, type MobileHealthState } from '../application/get-health-state';
import { HttpHealthClient } from '../infrastructure/http-health-client';
import { HealthScreen } from '../presentation/health-screen';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export function MobileHealthShell() {
  const client = useMemo(() => new HttpHealthClient(configuredBaseUrl), []);
  const [state, setState] = useState<MobileHealthState>({ kind: 'loading' });

  useEffect(() => {
    void getMobileHealthState(client).then(setState);
  }, [client]);

  return <HealthScreen state={state} />;
}

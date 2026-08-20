import { createHealthApiClient } from './infrastructure/health-api-client.ts';
import { readConfiguredApiBaseUrl } from './infrastructure/expo-api-config.ts';
import { MobileHealthShell } from './presentation/health-shell.tsx';

const healthCheck = createHealthApiClient({ apiBaseUrl: readConfiguredApiBaseUrl() });

export function MobileHealthRoot(): React.ReactElement {
  return <MobileHealthShell healthCheck={healthCheck} />;
}

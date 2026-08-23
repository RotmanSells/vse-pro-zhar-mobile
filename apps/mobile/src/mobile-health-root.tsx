import { readDevelopmentIdentityConfig } from './infrastructure/development-identity-config.ts';
import { createHealthApiClient } from './infrastructure/health-api-client.ts';
import { readConfiguredApiBaseUrl } from './infrastructure/expo-api-config.ts';
import { MobileHealthShell } from './presentation/health-shell.tsx';

const healthCheck = createHealthApiClient({ apiBaseUrl: readConfiguredApiBaseUrl() });
const developmentIdentityConfig = readDevelopmentIdentityConfig();

export function MobileHealthRoot(): React.ReactElement {
  return (
    <MobileHealthShell
      developmentIdentityEnabled={developmentIdentityConfig.enabled}
      healthCheck={healthCheck}
    />
  );
}

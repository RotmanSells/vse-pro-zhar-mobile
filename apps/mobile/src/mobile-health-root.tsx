import { readDevelopmentIdentityConfig } from './infrastructure/development-identity-config.ts';
import { createCategoryApiClient } from './infrastructure/category-api-client.ts';
import { createCustomerProfileApiClient } from './infrastructure/customer-profile-api-client.ts';
import { createLegalAcceptanceApiClient } from './infrastructure/legal-acceptance-api-client.ts';
import { createHealthApiClient } from './infrastructure/health-api-client.ts';
import { readConfiguredApiBaseUrl } from './infrastructure/expo-api-config.ts';
import { MobileHealthShell } from './presentation/health-shell.tsx';

const apiBaseUrl = readConfiguredApiBaseUrl();
const healthCheck = createHealthApiClient({ apiBaseUrl });
const profilePort = createCustomerProfileApiClient({ apiBaseUrl });
const legalAcceptancePort = createLegalAcceptanceApiClient({ apiBaseUrl });
const categoryPort = createCategoryApiClient({ apiBaseUrl });
const developmentIdentityConfig = readDevelopmentIdentityConfig();

export function MobileHealthRoot(): React.ReactElement {
  return (
    <MobileHealthShell
      categoryPort={categoryPort}
      developmentIdentityEnabled={developmentIdentityConfig.enabled}
      healthCheck={healthCheck}
      legalAcceptancePort={legalAcceptancePort}
      profilePort={profilePort}
    />
  );
}

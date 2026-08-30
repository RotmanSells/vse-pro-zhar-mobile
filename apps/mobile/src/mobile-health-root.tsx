import { readDevelopmentIdentityConfig } from './infrastructure/development-identity-config.ts';
import { createCategoryApiClient } from './infrastructure/category-api-client.ts';
import { createProductApiClient } from './infrastructure/product-api-client.ts';
import { createCustomerProfileApiClient } from './infrastructure/customer-profile-api-client.ts';
import { createLegalAcceptanceApiClient } from './infrastructure/legal-acceptance-api-client.ts';
import { readConfiguredApiBaseUrl } from './infrastructure/expo-api-config.ts';
import { MobileCustomerAppShell } from './presentation/customer-app/customer-app-shell.tsx';
import { MobileProductDetailsShell } from './presentation/catalog/product-details-shell.tsx';

const apiBaseUrl = readConfiguredApiBaseUrl();
const profilePort = createCustomerProfileApiClient({ apiBaseUrl });
const legalAcceptancePort = createLegalAcceptanceApiClient({ apiBaseUrl });
const categoryPort = createCategoryApiClient({ apiBaseUrl });
const productPort = createProductApiClient({ apiBaseUrl, apiVersion: 'v2' });
const developmentIdentityConfig = readDevelopmentIdentityConfig();

export function MobileHealthRoot(): React.ReactElement {
  return (
    <MobileCustomerAppShell
      categoryPort={categoryPort}
      developmentIdentityEnabled={developmentIdentityConfig.enabled}
      legalAcceptancePort={legalAcceptancePort}
      productPort={productPort}
      profilePort={profilePort}
    />
  );
}

export function MobileProductDetailsRoot({
  productId,
}: {
  readonly productId: string;
}): React.ReactElement {
  return <MobileProductDetailsShell productId={productId} productPort={productPort} />;
}

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  checkApiHealth,
  type HealthCheckPort,
  type HealthCheckResult,
} from '../application/check-api-health.ts';
import type { CustomerProfilePort } from '../application/customer-profile.ts';
import { DevelopmentIdentityPanel } from './development-identity-panel.tsx';

type HealthState = { readonly kind: 'loading' } | HealthCheckResult;

function messageFor(state: HealthState): string {
  if (state.kind === 'loading') return 'Проверяем доступность API…';
  if (state.kind === 'healthy') return 'API health: healthy';

  switch (state.reason) {
    case 'configuration':
      return 'API health: configuration error';
    case 'invalid_response':
      return 'API health: invalid response';
    case 'timeout':
      return 'API health: timeout';
    case 'network':
      return 'API health: unavailable';
  }
}

export function MobileHealthShell({
  healthCheck,
  profilePort,
  developmentIdentityEnabled = false,
}: {
  readonly healthCheck: HealthCheckPort;
  readonly profilePort: CustomerProfilePort;
  readonly developmentIdentityEnabled?: boolean;
}): React.ReactElement {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let mounted = true;
    void checkApiHealth(healthCheck).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [healthCheck]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      testID="mobile-shell"
    >
      <DevelopmentIdentityPanel enabled={developmentIdentityEnabled} profilePort={profilePort} />
      <Text accessibilityRole="header" style={styles.title}>
        Все Про Жар
      </Text>
      <Text>Мобильное приложение готово к запуску.</Text>
      <View testID="api-health-state">
        <Text
          accessibilityLabel="api-health-state"
          testID={state.kind === 'healthy' ? 'api-health-healthy' : undefined}
        >
          {messageFor(state)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
});

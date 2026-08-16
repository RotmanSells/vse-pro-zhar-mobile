import { StyleSheet, Text, View } from 'react-native';

import type { MobileHealthState } from '../application/get-health-state';

export function HealthScreen({ state }: { readonly state: MobileHealthState }) {
  if (state.kind === 'loading') {
    return <Text accessibilityLabel="health-loading">Checking API status…</Text>;
  }
  if (state.kind === 'unavailable') {
    return <Text accessibilityLabel="health-unavailable">API unavailable</Text>;
  }
  return (
    <View style={styles.container} accessibilityLabel="health-healthy">
      <Text style={styles.title}>Все Про Жар</Text>
      <Text>API healthy</Text>
      <Text>{state.response.version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});

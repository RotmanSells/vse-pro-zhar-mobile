import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  createDevelopmentIdentity,
  type DevelopmentIdentity,
} from '../application/development-identity.ts';

export function DevelopmentIdentityPanel({
  enabled,
}: {
  readonly enabled: boolean;
}): React.ReactElement | null {
  const [phone, setPhone] = useState('');
  const [identity, setIdentity] = useState<DevelopmentIdentity | undefined>();

  if (!enabled) return null;

  function continueWithDevelopmentIdentity(): void {
    const nextIdentity = createDevelopmentIdentity(phone);
    if (nextIdentity !== undefined) setIdentity(nextIdentity);
  }

  return (
    <View style={styles.container} testID="development-identity-panel">
      <Text accessibilityRole="header" style={styles.title}>
        Тестовый вход
      </Text>
      <Text>development identity — не настоящая SMS-аутентификация.</Text>
      <TextInput
        accessibilityLabel="Номер телефона"
        autoComplete="tel"
        keyboardType="phone-pad"
        onChangeText={setPhone}
        placeholder="Номер телефона"
        style={styles.input}
        testID="development-identity-phone"
        value={phone}
      />
      <Button
        disabled={phone.trim().length === 0}
        onPress={continueWithDevelopmentIdentity}
        title="Продолжить"
      />
      {identity === undefined ? null : (
        <Text testID="development-identity-state">
          Development identity создана для {identity.phone}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 24,
    width: '100%',
  },
  input: {
    borderColor: '#999999',
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
});

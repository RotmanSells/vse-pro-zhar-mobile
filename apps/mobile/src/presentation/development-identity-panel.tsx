import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  loadDevelopmentCustomerProfile,
  type CurrentCustomerProfilePort,
  type CustomerProfileFailureReason,
  type DevelopmentCustomerProfileConnection,
} from '../application/customer-profile.ts';
import {
  createDevelopmentIdentity,
  type DevelopmentIdentity,
} from '../application/development-identity.ts';

type DevelopmentProfileState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly identity: DevelopmentIdentity }
  | DevelopmentCustomerProfileConnection;

function errorMessage(reason: CustomerProfileFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Адрес backend API не настроен.';
    case 'invalid_response':
      return 'Backend вернул некорректный профиль.';
    case 'timeout':
      return 'Backend не ответил вовремя.';
    case 'network':
      return 'Backend сейчас недоступен.';
    case 'unauthorized':
      return 'Backend отклонил development identity.';
    case 'http':
      return 'Backend не смог загрузить профиль.';
  }
}

export function DevelopmentIdentityPanel({
  enabled,
  profilePort,
}: {
  readonly enabled: boolean;
  readonly profilePort: CurrentCustomerProfilePort;
}): React.ReactElement | null {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<DevelopmentProfileState>({ kind: 'idle' });

  if (!enabled) return null;

  function loadProfile(identity: DevelopmentIdentity): void {
    setState({ kind: 'loading', identity });
    void loadDevelopmentCustomerProfile(identity, profilePort).then(setState);
  }

  function continueWithDevelopmentIdentity(): void {
    const nextIdentity = createDevelopmentIdentity(phone);
    if (nextIdentity !== undefined) loadProfile(nextIdentity);
  }

  function changePhone(nextPhone: string): void {
    setPhone(nextPhone);
    if (nextPhone !== phone && (state.kind === 'connected' || state.kind === 'connection_error')) {
      setState({ kind: 'idle' });
    }
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
        editable={state.kind !== 'loading'}
        keyboardType="phone-pad"
        onChangeText={changePhone}
        placeholder="Номер телефона"
        style={styles.input}
        testID="development-identity-phone"
        value={phone}
      />
      <Button
        disabled={phone.trim().length === 0 || state.kind === 'loading'}
        onPress={continueWithDevelopmentIdentity}
        title="Продолжить"
      />
      {state.kind === 'loading' ? (
        <Text testID="development-profile-loading">Подключаем development identity к backend…</Text>
      ) : null}
      {state.kind === 'connected' ? (
        <View testID="development-profile-connected">
          <Text>Test identity подключена к backend</Text>
          <Text>Телефон: {state.profile.phone}</Text>
          {state.profile.name === null ? null : <Text>Имя: {state.profile.name}</Text>}
          {state.profile.birthday === null ? null : (
            <Text>Дата рождения: {state.profile.birthday}</Text>
          )}
        </View>
      ) : null}
      {state.kind === 'connection_error' ? (
        <View testID="development-profile-error">
          <Text>{errorMessage(state.reason)}</Text>
          <Button onPress={() => loadProfile(state.identity)} title="Повторить" />
        </View>
      ) : null}
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

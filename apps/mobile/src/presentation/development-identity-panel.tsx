import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';

import {
  loadDevelopmentCustomerProfile,
  profileDraftFrom,
  saveDevelopmentCustomerProfile,
  type CustomerProfileDraft,
  type CustomerProfileFailureReason,
  type CustomerProfilePort,
} from '../application/customer-profile.ts';
import {
  createDevelopmentIdentity,
  type DevelopmentIdentity,
} from '../application/development-identity.ts';

type DevelopmentProfileState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly identity: DevelopmentIdentity }
  | {
      readonly kind: 'connected';
      readonly identity: DevelopmentIdentity;
      readonly profile: CustomerProfileResponse;
      readonly draft: CustomerProfileDraft;
      readonly saveState:
        | { readonly kind: 'idle' }
        | { readonly kind: 'saving' }
        | { readonly kind: 'saved' }
        | { readonly kind: 'save_error'; readonly reason: CustomerProfileFailureReason };
    }
  | {
      readonly kind: 'connection_error';
      readonly identity: DevelopmentIdentity;
      readonly reason: CustomerProfileFailureReason;
    };

function errorMessage(reason: CustomerProfileFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Адрес backend API не настроен.';
    case 'invalid_request':
      return 'Проверьте имя и дату рождения.';
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
  readonly profilePort: CustomerProfilePort;
}): React.ReactElement | null {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<DevelopmentProfileState>({ kind: 'idle' });

  if (!enabled) return null;

  function loadProfile(identity: DevelopmentIdentity): void {
    setState({ kind: 'loading', identity });
    void loadDevelopmentCustomerProfile(identity, profilePort).then((result) => {
      if (result.kind === 'connected') {
        setState({
          ...result,
          draft: profileDraftFrom(result.profile),
          saveState: { kind: 'idle' },
        });
        return;
      }
      setState(result);
    });
  }

  function changeDraft(field: keyof CustomerProfileDraft, value: string): void {
    setState((current) =>
      current.kind === 'connected'
        ? {
            ...current,
            draft: { ...current.draft, [field]: value },
            saveState: { kind: 'idle' },
          }
        : current,
    );
  }

  function saveProfile(): void {
    if (state.kind !== 'connected' || state.saveState.kind === 'saving') return;
    const confirmedState = state;
    setState({ ...confirmedState, saveState: { kind: 'saving' } });
    void saveDevelopmentCustomerProfile(
      confirmedState.identity,
      confirmedState.draft,
      profilePort,
    ).then((result) => {
      if (result.kind === 'saved') {
        setState({
          kind: 'connected',
          identity: result.identity,
          profile: result.profile,
          draft: profileDraftFrom(result.profile),
          saveState: { kind: 'saved' },
        });
        return;
      }
      setState({
        ...confirmedState,
        saveState: { kind: 'save_error', reason: result.reason },
      });
    });
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
        editable={
          state.kind !== 'loading' &&
          !(state.kind === 'connected' && state.saveState.kind === 'saving')
        }
        keyboardType="phone-pad"
        onChangeText={changePhone}
        placeholder="Номер телефона"
        style={styles.input}
        testID="development-identity-phone"
        value={phone}
      />
      <Button
        disabled={
          phone.trim().length === 0 ||
          state.kind === 'loading' ||
          (state.kind === 'connected' && state.saveState.kind === 'saving')
        }
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
          <TextInput
            accessibilityLabel="Имя"
            editable={state.saveState.kind !== 'saving'}
            onChangeText={(value) => changeDraft('name', value)}
            placeholder="Имя (необязательно до первого заказа)"
            style={styles.input}
            testID="development-profile-name"
            value={state.draft.name}
          />
          <TextInput
            accessibilityLabel="Дата рождения"
            autoCapitalize="none"
            editable={state.saveState.kind !== 'saving'}
            onChangeText={(value) => changeDraft('birthday', value)}
            placeholder="ГГГГ-ММ-ДД (необязательно)"
            style={styles.input}
            testID="development-profile-birthday"
            value={state.draft.birthday}
          />
          <Button
            disabled={state.saveState.kind === 'saving'}
            onPress={saveProfile}
            title="Сохранить профиль"
          />
          {state.saveState.kind === 'saving' ? (
            <Text testID="development-profile-saving">Сохраняем профиль в backend…</Text>
          ) : null}
          {state.saveState.kind === 'saved' ? (
            <Text testID="development-profile-saved">Профиль сохранён в backend</Text>
          ) : null}
          {state.saveState.kind === 'save_error' ? (
            <View testID="development-profile-save-error">
              <Text>Профиль не сохранён. {errorMessage(state.saveState.reason)}</Text>
              <Button onPress={saveProfile} title="Повторить сохранение" />
            </View>
          ) : null}
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

import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';
import type { LegalAcceptanceResponse, LegalDocumentType } from '@vse-pro-zhar/contracts';

import {
  loadDevelopmentCustomerProfile,
  profileDraftFrom,
  saveDevelopmentCustomerProfile,
  type CustomerProfileDraft,
  type CustomerProfileFailureReason,
  type CustomerProfilePort,
} from '../application/customer-profile.ts';
import {
  acceptDevelopmentLegalDocument,
  loadDevelopmentLegalAcceptances,
  type LegalAcceptancePort,
} from '../application/legal-acceptance.ts';
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
      readonly legalState: DevelopmentLegalState;
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

type DevelopmentLegalState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'current';
      readonly legalAcceptances: LegalAcceptanceResponse;
      readonly action:
        | { readonly kind: 'idle' }
        | { readonly kind: 'accepting'; readonly documentType: LegalDocumentType }
        | { readonly kind: 'accepted'; readonly documentType: LegalDocumentType }
        | {
            readonly kind: 'acceptance_error';
            readonly documentType: LegalDocumentType;
            readonly reason: CustomerProfileFailureReason;
          };
    }
  | { readonly kind: 'load_error'; readonly reason: CustomerProfileFailureReason };

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

function legalDocumentLabel(documentType: LegalDocumentType): string {
  return documentType === 'privacy_policy' ? 'Privacy Policy' : 'User Agreement';
}

export function DevelopmentIdentityPanel({
  enabled,
  legalAcceptancePort,
  profilePort,
}: {
  readonly enabled: boolean;
  readonly legalAcceptancePort: LegalAcceptancePort;
  readonly profilePort: CustomerProfilePort;
}): React.ReactElement | null {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<DevelopmentProfileState>({ kind: 'idle' });

  if (!enabled) return null;

  function loadLegalAcceptances(identity: DevelopmentIdentity): void {
    void loadDevelopmentLegalAcceptances(identity, legalAcceptancePort).then((result) => {
      setState((current) => {
        if (current.kind !== 'connected' || current.identity.phone !== identity.phone)
          return current;
        return result.kind === 'legal_acceptances_loaded'
          ? {
              ...current,
              legalState: {
                action: { kind: 'idle' },
                kind: 'current',
                legalAcceptances: result.legalAcceptances,
              },
            }
          : { ...current, legalState: { kind: 'load_error', reason: result.reason } };
      });
    });
  }

  function loadProfile(identity: DevelopmentIdentity): void {
    setState({ kind: 'loading', identity });
    void loadDevelopmentCustomerProfile(identity, profilePort).then((result) => {
      if (result.kind === 'connected') {
        setState({
          ...result,
          draft: profileDraftFrom(result.profile),
          legalState: { kind: 'loading' },
          saveState: { kind: 'idle' },
        });
        loadLegalAcceptances(result.identity);
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
          legalState: confirmedState.legalState,
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

  function acceptLegalDocument(documentType: LegalDocumentType): void {
    if (
      state.kind !== 'connected' ||
      state.legalState.kind !== 'current' ||
      state.legalState.action.kind === 'accepting'
    ) {
      return;
    }
    const currentDocument = state.legalState.legalAcceptances.documents.find(
      (document) => document.documentType === documentType,
    );
    if (currentDocument?.status !== 'required') return;

    const identity = state.identity;
    setState((current) =>
      current.kind === 'connected' && current.identity.phone === identity.phone
        ? {
            ...current,
            legalState:
              current.legalState.kind === 'current'
                ? {
                    ...current.legalState,
                    action: { kind: 'accepting', documentType },
                  }
                : current.legalState,
          }
        : current,
    );
    void acceptDevelopmentLegalDocument(identity, documentType, legalAcceptancePort).then(
      (result) => {
        setState((current) => {
          if (current.kind !== 'connected' || current.identity.phone !== identity.phone)
            return current;
          if (result.kind === 'legal_acceptance_saved') {
            return {
              ...current,
              legalState: {
                action: { kind: 'accepted', documentType },
                kind: 'current',
                legalAcceptances: result.legalAcceptances,
              },
            };
          }
          if (current.legalState.kind !== 'current') return current;
          return {
            ...current,
            legalState: {
              ...current.legalState,
              action: { kind: 'acceptance_error', documentType, reason: result.reason },
            },
          };
        });
      },
    );
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

  const currentLegalState =
    state.kind === 'connected' && state.legalState.kind === 'current'
      ? state.legalState
      : undefined;
  const legalAcceptanceErrorAction =
    currentLegalState?.action.kind === 'acceptance_error' ? currentLegalState.action : undefined;

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
          <View testID="development-legal-acceptance">
            <Text>Legal acceptance: test-only metadata, not production legal documents.</Text>
            {state.legalState.kind === 'loading' ? (
              <Text testID="development-legal-acceptance-loading">
                Загружаем тестовые подтверждения документов…
              </Text>
            ) : null}
            {state.legalState.kind === 'load_error' ? (
              <View testID="development-legal-acceptance-load-error">
                <Text>
                  Подтверждения документов не загружены. {errorMessage(state.legalState.reason)}
                </Text>
                <Button
                  onPress={() => loadLegalAcceptances(state.identity)}
                  title="Повторить загрузку подтверждений"
                />
              </View>
            ) : null}
            {currentLegalState !== undefined
              ? currentLegalState.legalAcceptances.documents.map((document) => (
                  <View
                    key={document.documentType}
                    testID={`development-legal-${document.documentType}`}
                  >
                    <Text>
                      {legalDocumentLabel(document.documentType)}: {document.documentVersion}{' '}
                      (test-only)
                    </Text>
                    {document.status === 'accepted' ? (
                      <Text testID={`development-legal-${document.documentType}-accepted`}>
                        {legalDocumentLabel(document.documentType)} принята в backend
                      </Text>
                    ) : (
                      <Button
                        disabled={currentLegalState.action.kind === 'accepting'}
                        onPress={() => acceptLegalDocument(document.documentType)}
                        title={`Принять тестовую ${legalDocumentLabel(document.documentType)}`}
                      />
                    )}
                  </View>
                ))
              : null}
            {currentLegalState?.action.kind === 'accepting' ? (
              <Text testID="development-legal-acceptance-saving">
                Подтверждаем документ в backend…
              </Text>
            ) : null}
            {legalAcceptanceErrorAction !== undefined ? (
              <View testID="development-legal-acceptance-save-error">
                <Text>
                  Документ не подтверждён. {errorMessage(legalAcceptanceErrorAction.reason)}
                </Text>
                <Button
                  onPress={() => acceptLegalDocument(legalAcceptanceErrorAction.documentType)}
                  title="Повторить подтверждение документа"
                />
              </View>
            ) : null}
          </View>
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

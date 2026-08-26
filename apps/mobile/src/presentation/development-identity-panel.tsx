import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from './ui/tokens.ts';

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

function ActionButton({
  disabled = false,
  onPress,
  title,
  variant = 'primary',
}: {
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly title: string;
  readonly variant?: 'primary' | 'secondary';
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={variant === 'secondary' ? styles.secondaryButtonText : styles.primaryButtonText}>
        {title}
      </Text>
    </Pressable>
  );
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
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Тестовый вход
          </Text>
        </View>
        <Text style={styles.panelFlame}>🔥</Text>
      </View>
      <Text style={styles.description}>
        development identity — не настоящая SMS-аутентификация.
      </Text>
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
        placeholderTextColor={mobileColors.muted}
        style={styles.input}
        testID="development-identity-phone"
        value={phone}
      />
      <ActionButton
        disabled={
          phone.trim().length === 0 ||
          state.kind === 'loading' ||
          (state.kind === 'connected' && state.saveState.kind === 'saving')
        }
        onPress={continueWithDevelopmentIdentity}
        title="Продолжить"
      />
      {state.kind === 'loading' ? (
        <View style={[styles.statusCard, styles.loadingCard]}>
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.statusText} testID="development-profile-loading">
            Подключаем development identity к backend…
          </Text>
        </View>
      ) : null}
      {state.kind === 'connected' ? (
        <View style={styles.connectedCard} testID="development-profile-connected">
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedBadgeText}>● BACKEND CONFIRMED</Text>
          </View>
          <Text style={styles.connectedTitle}>Test identity подключена к backend</Text>
          <View style={styles.confirmedData}>
            <Text style={styles.confirmedDataText}>Телефон: {state.profile.phone}</Text>
            {state.profile.name === null ? null : (
              <Text style={styles.confirmedDataText}>Имя: {state.profile.name}</Text>
            )}
          </View>
          {state.profile.birthday === null ? null : (
            <Text style={styles.confirmedDataText}>Дата рождения: {state.profile.birthday}</Text>
          )}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Профиль</Text>
            <TextInput
              accessibilityLabel="Имя"
              editable={state.saveState.kind !== 'saving'}
              onChangeText={(value) => changeDraft('name', value)}
              placeholder="Имя (необязательно до первого заказа)"
              placeholderTextColor={mobileColors.muted}
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
              placeholderTextColor={mobileColors.muted}
              style={styles.input}
              testID="development-profile-birthday"
              value={state.draft.birthday}
            />
            <ActionButton
              disabled={state.saveState.kind === 'saving'}
              onPress={saveProfile}
              title="Сохранить профиль"
            />
          </View>
          {state.saveState.kind === 'saving' ? (
            <View style={[styles.statusCard, styles.loadingCard]}>
              <ActivityIndicator color={mobileColors.secondary} />
              <Text style={styles.statusText} testID="development-profile-saving">
                Сохраняем профиль в backend…
              </Text>
            </View>
          ) : null}
          {state.saveState.kind === 'saved' ? (
            <View style={[styles.statusCard, styles.successCard]}>
              <Text style={styles.statusText} testID="development-profile-saved">
                Профиль сохранён в backend
              </Text>
            </View>
          ) : null}
          {state.saveState.kind === 'save_error' ? (
            <View
              style={[styles.statusCard, styles.errorCard]}
              testID="development-profile-save-error"
            >
              <Text style={styles.statusText}>
                Профиль не сохранён. {errorMessage(state.saveState.reason)}
              </Text>
              <ActionButton
                onPress={saveProfile}
                title="Повторить сохранение"
                variant="secondary"
              />
            </View>
          ) : null}
          <View style={styles.legalCard} testID="development-legal-acceptance">
            <Text style={styles.formTitle}>Legal acceptance</Text>
            <Text style={styles.description}>
              test-only metadata, not production legal documents.
            </Text>
            {state.legalState.kind === 'loading' ? (
              <View style={[styles.statusCard, styles.loadingCard]}>
                <ActivityIndicator color={mobileColors.secondary} />
                <Text style={styles.statusText} testID="development-legal-acceptance-loading">
                  Загружаем тестовые подтверждения документов…
                </Text>
              </View>
            ) : null}
            {state.legalState.kind === 'load_error' ? (
              <View
                style={[styles.statusCard, styles.errorCard]}
                testID="development-legal-acceptance-load-error"
              >
                <Text style={styles.statusText}>
                  Подтверждения документов не загружены. {errorMessage(state.legalState.reason)}
                </Text>
                <ActionButton
                  onPress={() => loadLegalAcceptances(state.identity)}
                  title="Повторить загрузку подтверждений"
                />
              </View>
            ) : null}
            {currentLegalState !== undefined
              ? currentLegalState.legalAcceptances.documents.map((document) => (
                  <View
                    key={document.documentType}
                    style={styles.documentCard}
                    testID={`development-legal-${document.documentType}`}
                  >
                    <Text style={styles.documentTitle}>
                      {legalDocumentLabel(document.documentType)}: {document.documentVersion}{' '}
                      (test-only)
                    </Text>
                    {document.status === 'accepted' ? (
                      <Text
                        style={styles.acceptedText}
                        testID={`development-legal-${document.documentType}-accepted`}
                      >
                        {legalDocumentLabel(document.documentType)} принята в backend
                      </Text>
                    ) : (
                      <ActionButton
                        disabled={currentLegalState.action.kind === 'accepting'}
                        onPress={() => acceptLegalDocument(document.documentType)}
                        title={`Принять тестовую ${legalDocumentLabel(document.documentType)}`}
                      />
                    )}
                  </View>
                ))
              : null}
            {currentLegalState?.action.kind === 'accepting' ? (
              <View style={[styles.statusCard, styles.loadingCard]}>
                <ActivityIndicator color={mobileColors.secondary} />
                <Text style={styles.statusText} testID="development-legal-acceptance-saving">
                  Подтверждаем документ в backend…
                </Text>
              </View>
            ) : null}
            {legalAcceptanceErrorAction !== undefined ? (
              <View
                style={[styles.statusCard, styles.errorCard]}
                testID="development-legal-acceptance-save-error"
              >
                <Text style={styles.statusText}>
                  Документ не подтверждён. {errorMessage(legalAcceptanceErrorAction.reason)}
                </Text>
                <ActionButton
                  onPress={() => acceptLegalDocument(legalAcceptanceErrorAction.documentType)}
                  title="Повторить подтверждение документа"
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {state.kind === 'connection_error' ? (
        <View style={[styles.statusCard, styles.errorCard]} testID="development-profile-error">
          <Text style={styles.statusText}>{errorMessage(state.reason)}</Text>
          <ActionButton
            onPress={() => loadProfile(state.identity)}
            title="Повторить"
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.card,
    gap: mobileSpacing.compact,
    marginBottom: mobileSpacing.section,
    padding: mobileSpacing.card,
    width: '100%',
    ...mobileShadows.card,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  eyebrow: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  panelFlame: {
    fontSize: 28,
  },
  description: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#fafafa',
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.bodySize,
    paddingHorizontal: mobileSpacing.control,
    paddingVertical: 12,
  },
  title: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.sectionTitleSize,
    fontWeight: '800',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: mobileRadii.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: mobileSpacing.card,
    paddingVertical: 12,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: mobileColors.primary,
    ...mobileShadows.fire,
  },
  secondaryButton: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderWidth: 1,
  },
  primaryButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.bodySize,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: mobileRadii.control,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  loadingCard: {
    backgroundColor: mobileColors.warningSurface,
  },
  successCard: {
    backgroundColor: mobileColors.successSurface,
  },
  errorCard: {
    backgroundColor: mobileColors.dangerSurface,
  },
  statusText: {
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    lineHeight: 18,
  },
  confirmedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: mobileColors.successSurface,
    borderRadius: mobileRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedBadgeText: {
    color: mobileColors.success,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  connectedCard: {
    backgroundColor: mobileColors.lightBackground,
    borderRadius: mobileRadii.control,
    gap: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  connectedTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.bodySize,
    fontWeight: '800',
  },
  confirmedData: {
    gap: 3,
  },
  confirmedDataText: {
    color: '#5a544c',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
  },
  formSection: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.control,
    gap: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  formTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.bodySize,
    fontWeight: '800',
  },
  legalCard: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    gap: mobileSpacing.compact,
    marginTop: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  documentCard: {
    backgroundColor: mobileColors.lightBackground,
    borderRadius: mobileRadii.control,
    gap: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  documentTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
  acceptedText: {
    color: mobileColors.success,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
});

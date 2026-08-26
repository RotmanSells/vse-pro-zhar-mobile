import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  checkApiHealth,
  type HealthCheckPort,
  type HealthCheckResult,
} from '../application/check-api-health.ts';
import type { CategoryListPort } from '../application/catalog/category.ts';
import type { CustomerProfilePort } from '../application/customer-profile.ts';
import type { LegalAcceptancePort } from '../application/legal-acceptance.ts';
import { MobileCategoryShell } from './catalog/category-shell.tsx';
import { DevelopmentIdentityPanel } from './development-identity-panel.tsx';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from './ui/tokens.ts';

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
  legalAcceptancePort,
  profilePort,
  categoryPort,
  developmentIdentityEnabled = false,
}: {
  readonly healthCheck: HealthCheckPort;
  readonly legalAcceptancePort: LegalAcceptancePort;
  readonly profilePort: CustomerProfilePort;
  readonly categoryPort: CategoryListPort;
  readonly developmentIdentityEnabled?: boolean;
}): React.ReactElement {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    void checkApiHealth(healthCheck).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [attempt, healthCheck]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="mobile-shell"
      >
        <View style={styles.header} testID="mobile-shell-header">
          <View style={styles.brandLockup}>
            <Text accessibilityLabel="Огонь" style={styles.flame}>
              🔥
            </Text>
            <Text accessibilityRole="header" style={styles.brand}>
              Все Про Жар
            </Text>
          </View>
          {developmentIdentityEnabled ? (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>TEST UI</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>GRILL DELIVERY</Text>
          <Text style={styles.heroTitle}>Мобильное приложение готово к запуску.</Text>
          <Text style={styles.heroCopy}>Проверяем доступность сервисов и каталога.</Text>
        </View>

        <DevelopmentIdentityPanel
          enabled={developmentIdentityEnabled}
          legalAcceptancePort={legalAcceptancePort}
          profilePort={profilePort}
        />
        <MobileCategoryShell categoryPort={categoryPort} />

        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <View>
              <Text style={styles.sectionTitle}>Состояние API</Text>
              <Text style={styles.sectionSubtitle}>Операционный статус</Text>
            </View>
            <View
              style={[
                styles.statusDot,
                state.kind === 'healthy' ? styles.statusDotHealthy : styles.statusDotPending,
              ]}
            />
          </View>
          <View
            style={[
              styles.healthState,
              state.kind === 'healthy'
                ? styles.healthStateHealthy
                : state.kind === 'loading'
                  ? styles.healthStateLoading
                  : styles.healthStateError,
            ]}
            testID="api-health-state"
          >
            {state.kind === 'loading' ? (
              <ActivityIndicator color={mobileColors.secondary} testID="api-health-loading" />
            ) : null}
            <Text
              accessibilityLabel="api-health-state"
              style={styles.healthMessage}
              testID={state.kind === 'healthy' ? 'api-health-healthy' : undefined}
            >
              {messageFor(state)}
            </Text>
            {state.kind === 'unhealthy' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setState({ kind: 'loading' });
                  setAttempt((current) => current + 1);
                }}
                style={({ pressed }) => [styles.retryButton, pressed ? styles.buttonPressed : null]}
                testID="api-health-retry"
              >
                <Text style={styles.retryButtonText}>Повторить</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: mobileColors.charcoal,
    flex: 1,
  },
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    paddingBottom: mobileSpacing.section,
    paddingHorizontal: mobileSpacing.screen,
  },
  header: {
    alignItems: 'center',
    backgroundColor: mobileColors.charcoal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -mobileSpacing.screen,
    paddingBottom: mobileSpacing.control,
    paddingHorizontal: mobileSpacing.screen,
    paddingTop: mobileSpacing.control,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: mobileSpacing.compact,
  },
  flame: {
    fontSize: 22,
  },
  brand: {
    color: mobileColors.secondary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  testBadge: {
    backgroundColor: 'rgba(255,149,0,0.16)',
    borderColor: 'rgba(255,149,0,0.45)',
    borderRadius: mobileRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  testBadgeText: {
    color: mobileColors.gold,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: mobileColors.charcoal,
    borderBottomLeftRadius: mobileRadii.hero,
    borderBottomRightRadius: mobileRadii.hero,
    marginHorizontal: -mobileSpacing.screen,
    marginBottom: mobileSpacing.section,
    overflow: 'hidden',
    paddingHorizontal: mobileSpacing.screen,
    paddingVertical: 22,
    ...mobileShadows.fire,
  },
  eyebrow: {
    color: mobileColors.gold,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.sectionTitleSize,
    fontWeight: '800',
    lineHeight: 24,
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    marginTop: 6,
  },
  healthCard: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.card,
    marginTop: mobileSpacing.section,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  healthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: mobileSpacing.control,
  },
  sectionTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.sectionTitleSize,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    marginTop: 3,
  },
  statusDot: {
    borderRadius: mobileRadii.pill,
    height: 12,
    width: 12,
  },
  statusDotHealthy: {
    backgroundColor: mobileColors.success,
  },
  statusDotPending: {
    backgroundColor: mobileColors.secondary,
  },
  healthState: {
    alignItems: 'center',
    borderRadius: mobileRadii.control,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileSpacing.compact,
    padding: mobileSpacing.control,
  },
  healthStateHealthy: {
    backgroundColor: mobileColors.successSurface,
  },
  healthStateLoading: {
    backgroundColor: mobileColors.warningSurface,
  },
  healthStateError: {
    backgroundColor: mobileColors.dangerSurface,
  },
  healthMessage: {
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.bodySize,
  },
  retryButton: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    paddingHorizontal: mobileSpacing.control,
    paddingVertical: mobileSpacing.compact,
  },
  retryButtonText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});

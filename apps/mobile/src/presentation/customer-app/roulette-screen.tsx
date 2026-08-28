import { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { formatRubPrice } from '../../application/customer-experience.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

const prizes = [
  ['🥫', 'Бесплатный соус', 'бесплатно'],
  ['🍺', 'Напиток в подарок', 'бесплатно'],
  ['🔥', '+50 Угольков', 'на баланс'],
  ['💰', 'Скидка 10%', 'промокод'],
  ['🍽️', 'Комбо «Гриль-мастер»', 'подарок'],
  ['🎲', 'Попробуй ещё раз', 'в другой раз'],
] as const;

export function MobileRouletteScreen({
  cartTotalMinor,
}: {
  readonly cartTotalMinor: number;
}): React.ReactElement {
  const [demoMode, setDemoMode] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const rotation = useMemo(() => new Animated.Value(0), []);
  const thresholdMinor = 150_000;
  const canSpin = demoMode || cartTotalMinor >= thresholdMinor;

  function spin(): void {
    if (!canSpin || spinning) return;
    setSpinning(true);
    Animated.timing(rotation, {
      duration: 1_800,
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      rotation.setValue(0);
      setSpinning(false);
    });
  }

  const wheelRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="customer-roulette-screen"
    >
      <Text accessibilityRole="header" style={styles.title}>
        🎡 Поймай искру
      </Text>
      <Text style={styles.subtitle}>Крути колесо и забирай призы!</Text>

      <View style={styles.wheelWrap}>
        <View style={styles.pointer} />
        <Animated.View style={[styles.wheel, { transform: [{ rotate: wheelRotation }] }]}>
          {prizes.map(([emoji], index) => (
            <View
              key={emoji}
              style={[styles.wheelPrize, { transform: [{ rotate: `${index * 60}deg` }] }]}
            >
              <Text style={styles.wheelEmoji}>{emoji}</Text>
            </View>
          ))}
          <View style={styles.wheelHub}>
            <Text style={styles.wheelHubText}>🔥</Text>
          </View>
        </Animated.View>
      </View>

      <View style={[styles.infoCard, !canSpin ? styles.infoCardLocked : null]}>
        <Text style={styles.infoText}>
          {demoMode
            ? '🧪 Демо-режим — рулетка доступна без заказа!'
            : canSpin
              ? `✅ Заказ на ${formatRubPrice(cartTotalMinor)} — рулетка доступна!`
              : 'Сделайте заказ от 1500₽, чтобы крутить рулетку!'}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${demoMode ? 100 : Math.min(100, (cartTotalMinor / thresholdMinor) * 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.demoRow}>
        <Text style={styles.demoLabel}>🧪 Демо-режим</Text>
        <Switch
          accessibilityLabel="Демо-режим рулетки"
          onValueChange={setDemoMode}
          thumbColor={mobileColors.card}
          trackColor={{ false: '#ccc', true: mobileColors.primary }}
          value={demoMode}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSpin || spinning }}
        disabled={!canSpin || spinning}
        onPress={spin}
        style={({ pressed }) => [
          styles.spinButton,
          !canSpin ? styles.spinButtonDisabled : null,
          pressed ? styles.pressed : null,
        ]}
        testID="roulette-spin"
      >
        <Text style={[styles.spinButtonText, !canSpin ? styles.spinButtonDisabledText : null]}>
          {spinning ? '🎡 Крутим…' : canSpin ? '🔥 КРУТИТЬ' : '🔒 ЗАКАЗ ОТ 1500₽'}
        </Text>
      </Pressable>

      <View style={styles.prizesCard}>
        <Text style={styles.prizesTitle}>🎁 Возможные призы</Text>
        {prizes.map(([emoji, title, kind]) => (
          <View key={title} style={styles.prizeRow}>
            <Text style={styles.prizeName}>
              {emoji} {title}
            </Text>
            <Text style={styles.prizeKind}>{kind}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  title: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    marginBottom: 22,
    marginTop: 6,
    textAlign: 'center',
  },
  wheelWrap: {
    alignSelf: 'center',
    height: 300,
    marginBottom: 26,
    width: 300,
  },
  pointer: {
    alignSelf: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 0,
    borderLeftColor: 'transparent',
    borderLeftWidth: 14,
    borderRightColor: 'transparent',
    borderRightWidth: 14,
    borderTopColor: mobileColors.accent,
    borderTopWidth: 24,
    height: 0,
    position: 'absolute',
    top: -6,
    width: 0,
    zIndex: 5,
  },
  wheel: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderColor: mobileColors.gold,
    borderRadius: 150,
    borderWidth: 8,
    height: 300,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 300,
    ...mobileShadows.card,
  },
  wheelPrize: {
    alignItems: 'center',
    backgroundColor: mobileColors.secondary,
    borderColor: 'rgba(26,26,26,0.45)',
    borderWidth: 1,
    height: 110,
    justifyContent: 'flex-start',
    position: 'absolute',
    top: 12,
    transformOrigin: '50% 138px',
    width: 80,
  },
  wheelEmoji: {
    fontSize: 24,
    marginTop: 8,
  },
  wheelHub: {
    alignItems: 'center',
    backgroundColor: mobileColors.charcoal,
    borderColor: mobileColors.gold,
    borderRadius: 30,
    borderWidth: 3,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    width: 60,
    zIndex: 4,
  },
  wheelHubText: {
    fontSize: 26,
  },
  infoCard: {
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    marginBottom: 14,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  infoCardLocked: {
    opacity: 0.86,
  },
  infoText: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    backgroundColor: '#eee4d8',
    borderRadius: 10,
    height: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: mobileColors.primary,
    borderRadius: 10,
    height: '100%',
  },
  demoRow: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.control,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: mobileSpacing.card,
    paddingVertical: 8,
    ...mobileShadows.card,
  },
  demoLabel: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  spinButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: mobileRadii.card,
    justifyContent: 'center',
    marginBottom: 24,
    padding: 18,
    ...mobileShadows.fire,
  },
  spinButtonDisabled: {
    backgroundColor: '#c9c2b9',
    shadowOpacity: 0,
  },
  spinButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  spinButtonDisabledText: {
    color: '#7a746c',
  },
  prizesCard: {
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    marginBottom: 24,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  prizesTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  prizeRow: {
    alignItems: 'center',
    borderBottomColor: mobileColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  prizeName: {
    color: '#5a544c',
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
  },
  prizeKind: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});

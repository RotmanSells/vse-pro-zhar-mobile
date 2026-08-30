import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mobileColors, mobileRadii, mobileTypography } from '../ui/tokens.ts';

export function CustomerHeader({
  coal,
  onAddCoal,
}: {
  readonly coal: number;
  readonly onAddCoal: () => void;
}): React.ReactElement {
  return (
    <View style={styles.header} testID="customer-header">
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.headerRow}>
        <View style={styles.logo}>
          <Text accessibilityLabel="Огонь" style={styles.flame}>
            🔥
          </Text>
          <Text accessibilityRole="header" style={styles.logoText}>
            Все Про Жар
          </Text>
        </View>
        <Pressable
          accessibilityHint="Добавляет демонстрационные угольки"
          accessibilityLabel={`${coal} угольков`}
          accessibilityRole="button"
          onPress={onAddCoal}
          style={({ pressed }) => [styles.coalBalance, pressed ? styles.pressed : null]}
        >
          <Text style={styles.coalIcon}>🔥</Text>
          <Text style={styles.coalCount}>{coal}</Text>
          <Text style={styles.coalAdd}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: mobileColors.charcoal,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  glowOne: {
    backgroundColor: 'rgba(255,149,0,0.18)',
    borderRadius: 120,
    height: 180,
    position: 'absolute',
    right: -62,
    top: -104,
    width: 180,
  },
  glowTwo: {
    backgroundColor: 'rgba(255,51,51,0.13)',
    borderRadius: 100,
    bottom: -96,
    height: 170,
    left: -82,
    position: 'absolute',
    width: 170,
  },
  logo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  flame: {
    fontSize: 22,
  },
  logoText: {
    color: mobileColors.secondary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  coalBalance: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.16)',
    borderColor: 'rgba(255,149,0,0.4)',
    borderRadius: mobileRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  coalIcon: {
    fontSize: 16,
  },
  coalCount: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 15,
    fontWeight: '700',
  },
  coalAdd: {
    color: mobileColors.gold,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});

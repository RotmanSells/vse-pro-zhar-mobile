import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

export function MobileProfileScreen({
  coal,
  developmentIdentityPanel,
  onOpenPassport,
  xp = 450,
}: {
  readonly coal: number;
  readonly developmentIdentityPanel?: React.ReactElement;
  readonly onOpenPassport: () => void;
  readonly xp?: number;
}): React.ReactElement {
  const [bonusCollapsed, setBonusCollapsed] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [darkEnabled, setDarkEnabled] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="customer-profile-screen"
    >
      <View style={styles.profileHead}>
        <View style={styles.profileGlow} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👨‍🍳</Text>
        </View>
        <Text style={styles.profileName}>Гриль-Мастер</Text>
        <View style={styles.profileCoal}>
          <Text>🔥</Text>
          <Text style={styles.profileCoalText}>{coal} Угольков</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard value="0" label="Заказов сделано" />
        <StatCard value={String(Math.max(0, 500 - xp))} label="До след. награды" />
        <View style={styles.statCardWide}>
          <StatCard value="—" label="Любимое блюдо" />
        </View>
      </View>

      <View style={styles.bonusCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: !bonusCollapsed }}
          onPress={() => setBonusCollapsed((current) => !current)}
          style={styles.bonusHeader}
        >
          <Text style={styles.bonusTitle}>🔥 Как работает бонусная система</Text>
          <Text style={styles.bonusChevron}>{bonusCollapsed ? '▾' : '▴'}</Text>
        </Pressable>
        {bonusCollapsed ? null : (
          <View style={styles.bonusBody}>
            <BonusItem icon="🔥">
              <Text>
                <Text style={styles.bold}>Угольки</Text> — внутренняя валюта. За каждый заказ вы
                получаете <Text style={styles.highlight}>5%</Text> от суммы угольками.
              </Text>
            </BonusItem>
            <BonusItem icon="⭐">
              <Text>
                <Text style={styles.bold}>XP (опыт)</Text> — повышает ваш ранг. За каждые{' '}
                <Text style={styles.bold}>10₽</Text> в заказе даётся{' '}
                <Text style={styles.highlight}>1 XP</Text>.
              </Text>
            </BonusItem>
            <BonusItem icon="🏕️">
              <Text>
                <Text style={styles.bold}>Ранги:</Text> 🏕️ Гость у костра → 🔥 Разжигатель → 🍳
                Мастер мангала → 👑 Повелитель Жара.
              </Text>
            </BonusItem>
            <BonusItem icon="🎡">
              <Text>
                <Text style={styles.bold}>Рулетка «Поймай искру»</Text> — доступна при заказе от{' '}
                <Text style={styles.highlight}>1500₽</Text>.
              </Text>
            </BonusItem>
            <BonusItem icon="🎯">
              <Text>
                <Text style={styles.bold}>Квесты</Text> — задания в Паспорте. За выполнение
                начисляются <Text style={styles.highlight}>XP и Угольки</Text>.
              </Text>
            </BonusItem>
            <BonusItem icon="🎁">
              <Text>
                <Text style={styles.bold}>Промокоды</Text> вводятся в корзине:{' '}
                <Text style={styles.highlight}>SPARK10</Text>,{' '}
                <Text style={styles.highlight}>FIRE500</Text>,{' '}
                <Text style={styles.highlight}>UGOL100</Text>.
              </Text>
            </BonusItem>
            <Pressable accessibilityRole="button" onPress={onOpenPassport} style={styles.bonusCta}>
              <Text style={styles.bonusCtaText}>🏆 Открыть мой Паспорт</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>⚙️ Настройки</Text>
        <SettingRow
          label="🔔 Push-уведомления"
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <SettingRow
          label="📧 Email-рассылка"
          value={emailEnabled}
          onValueChange={setEmailEnabled}
        />
        <SettingRow label="🌙 Тёмная тема" value={darkEnabled} onValueChange={setDarkEnabled} />
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>📜 История заказов</Text>
        <Text style={styles.emptyHistory}>Пока нет заказов</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => undefined} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Войти / зарегистрироваться</Text>
      </Pressable>

      {developmentIdentityPanel === undefined ? null : (
        <View style={styles.developmentSection}>
          <Text style={styles.developmentTitle}>TEST UI</Text>
          {developmentIdentityPanel}
        </View>
      )}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BonusItem({
  children,
  icon,
}: {
  readonly children: React.ReactElement;
  readonly icon: string;
}): React.ReactElement {
  return (
    <View style={styles.bonusItem}>
      <View style={styles.bonusIcon}>
        <Text style={styles.bonusIconText}>{icon}</Text>
      </View>
      <Text style={styles.bonusText}>{children}</Text>
    </View>
  );
}

function SettingRow({
  label,
  onValueChange,
  value,
}: {
  readonly label: string;
  readonly onValueChange: (value: boolean) => void;
  readonly value: boolean;
}): React.ReactElement {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={mobileColors.card}
        trackColor={{ false: '#ccc', true: mobileColors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    padding: mobileSpacing.screen,
  },
  profileHead: {
    alignItems: 'center',
    backgroundColor: mobileColors.charcoal,
    borderRadius: mobileRadii.hero,
    marginBottom: mobileSpacing.section,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 24,
    position: 'relative',
  },
  profileGlow: {
    backgroundColor: 'rgba(255,149,0,0.2)',
    borderRadius: 160,
    height: 220,
    position: 'absolute',
    top: -155,
    width: 260,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderColor: 'rgba(255,200,61,0.5)',
    borderRadius: 44,
    borderWidth: 3,
    height: 88,
    justifyContent: 'center',
    marginBottom: 12,
    width: 88,
    zIndex: 1,
    ...mobileShadows.card,
  },
  avatarText: {
    fontSize: 40,
  },
  profileName: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '800',
    zIndex: 1,
  },
  profileCoal: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.18)',
    borderColor: 'rgba(255,149,0,0.4)',
    borderRadius: mobileRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    zIndex: 1,
  },
  profileCoalText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: mobileSpacing.section,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    flex: 1,
    minWidth: '45%',
    padding: 14,
    ...mobileShadows.card,
  },
  statCardWide: {
    flexBasis: '100%',
  },
  statValue: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    marginTop: 3,
  },
  bonusCard: {
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    marginBottom: mobileSpacing.section,
    overflow: 'hidden',
    ...mobileShadows.card,
  },
  bonusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  bonusTitle: {
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 15,
    fontWeight: '800',
  },
  bonusChevron: {
    color: mobileColors.muted,
    fontSize: 16,
  },
  bonusBody: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  bonusItem: {
    borderTopColor: mobileColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 10,
  },
  bonusIcon: {
    alignItems: 'center',
    backgroundColor: '#fff3e6',
    borderRadius: 10,
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  bonusIconText: {
    fontSize: 18,
  },
  bonusText: {
    color: '#5a544c',
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12.5,
    lineHeight: 18,
  },
  bold: {
    color: mobileColors.charcoal,
    fontWeight: '700',
  },
  highlight: {
    color: mobileColors.primary,
    fontWeight: '700',
  },
  bonusCta: {
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1.5,
    marginTop: 12,
    padding: 12,
  },
  bonusCtaText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  settingsCard: {
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    marginBottom: mobileSpacing.section,
    overflow: 'hidden',
    ...mobileShadows.card,
  },
  cardTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  settingRow: {
    alignItems: 'center',
    borderTopColor: mobileColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  settingLabel: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
  },
  emptyHistory: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    padding: 16,
  },
  logoutButton: {
    backgroundColor: mobileColors.card,
    borderColor: '#ffd6cc',
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    padding: 15,
  },
  logoutText: {
    color: mobileColors.accent,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  developmentSection: {
    marginTop: 6,
  },
  developmentTitle: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bottomSpace: {
    height: 24,
  },
});

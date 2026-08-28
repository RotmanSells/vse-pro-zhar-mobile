import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getRankProgress } from '../../application/customer-experience.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

const quests = [
  {
    icon: '🥩',
    title: 'Мясной Босс',
    description: 'Попробуйте 5 видов мяса',
    progress: 3,
    goal: 5,
    unit: 'вида',
  },
  {
    icon: '🛎️',
    title: 'Первый заказ',
    description: 'Сделайте первый заказ',
    progress: 1,
    goal: 1,
    unit: '',
  },
  {
    icon: '💰',
    title: 'Щедрый гость',
    description: 'Закажите на общую сумму 3000₽',
    progress: 1_500,
    goal: 3_000,
    unit: '₽',
  },
  {
    icon: '🏆',
    title: 'Дегустатор',
    description: 'Попробуйте все соусы',
    progress: 0,
    goal: 4,
    unit: 'соуса',
  },
] as const;

export function MobilePassportScreen({ xp = 450 }: { readonly xp?: number }): React.ReactElement {
  const rank = getRankProgress(xp);
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="customer-passport-screen"
    >
      <View style={styles.rankCard}>
        <Text style={styles.rankFlame}>🔥</Text>
        <View style={styles.rankRow}>
          <View style={styles.rankIcon}>
            <Text style={styles.rankIconText}>{rank.icon}</Text>
          </View>
          <View>
            <Text style={styles.rankName}>{rank.name}</Text>
            <Text style={styles.rankXpText}>
              {rank.xp} / {rank.nextRankXp ?? 'MAX'} XP
            </Text>
          </View>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${rank.percent}%` }]} />
        </View>
        <Text style={styles.nextRank}>
          {rank.nextRankName === undefined
            ? '👑 Вы достигли вершины — Повелитель Жара!'
            : `До ранга «${rank.nextRankName}» осталось ${rank.nextRankXp! - rank.xp} XP`}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>🎯 Квесты</Text>
      <View style={styles.questGrid}>
        {quests.map((quest) => {
          const progress = Math.min(quest.goal, quest.progress);
          const done = progress >= quest.goal;
          const value =
            quest.unit === '₽' ? `${progress}₽` : `${progress} / ${quest.goal} ${quest.unit}`;
          return (
            <View key={quest.title} style={[styles.questCard, done ? styles.questDone : null]}>
              <View style={[styles.questIcon, done ? styles.questIconDone : null]}>
                <Text style={styles.questIconText}>{quest.icon}</Text>
              </View>
              <View style={styles.questInfo}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questDescription}>{quest.description}</Text>
                <Text style={styles.questProgress}>{value}</Text>
                <View style={styles.questTrack}>
                  <View
                    style={[styles.questFill, { width: `${(progress / quest.goal) * 100}%` }]}
                  />
                </View>
              </View>
              <Text style={styles.questCheck}>{done ? '✅' : ''}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>🏆 Награды ранга</Text>
      <View style={styles.questGrid}>
        <RewardCard
          icon="🎁"
          title="Бонус +100 Угольков"
          description="Награда при достижении ранга «Разжигатель»"
        />
        <RewardCard
          locked
          icon="🔒"
          title="Секретное меню 🔒"
          description="Откройте, став «Повелителем Жара»"
        />
      </View>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function RewardCard({
  description,
  icon,
  locked = false,
  title,
}: {
  readonly description: string;
  readonly icon: string;
  readonly locked?: boolean;
  readonly title: string;
}): React.ReactElement {
  return (
    <View style={[styles.questCard, locked ? styles.questLocked : null]}>
      <View style={styles.questIcon}>
        <Text style={styles.questIconText}>{icon}</Text>
      </View>
      <View style={styles.questInfo}>
        <Text style={styles.questTitle}>{title}</Text>
        <Text style={styles.questDescription}>{description}</Text>
      </View>
      {locked ? <Text style={styles.lockIcon}>🔒</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    padding: mobileSpacing.screen,
  },
  rankCard: {
    backgroundColor: mobileColors.charcoal,
    borderRadius: mobileRadii.hero,
    marginBottom: mobileSpacing.section,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
    ...mobileShadows.card,
  },
  rankFlame: {
    bottom: -22,
    color: 'rgba(255,149,0,0.14)',
    fontSize: 120,
    position: 'absolute',
    right: -10,
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  rankIcon: {
    alignItems: 'center',
    backgroundColor: mobileColors.secondary,
    borderColor: 'rgba(255,149,0,0.35)',
    borderRadius: 30,
    borderWidth: 3,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  rankIconText: {
    fontSize: 26,
  },
  rankName: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 18,
    fontWeight: '800',
  },
  rankXpText: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    marginTop: 2,
  },
  xpTrack: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    height: 12,
    overflow: 'hidden',
  },
  xpFill: {
    backgroundColor: mobileColors.gold,
    borderRadius: 10,
    height: '100%',
  },
  nextRank: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    marginTop: 8,
  },
  sectionTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  questGrid: {
    gap: 12,
  },
  questCard: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    ...mobileShadows.card,
  },
  questDone: {
    borderColor: 'rgba(63,191,56,0.2)',
    borderWidth: 1,
  },
  questLocked: {
    opacity: 0.6,
  },
  questIcon: {
    alignItems: 'center',
    backgroundColor: '#fff3e6',
    borderRadius: 14,
    flexShrink: 0,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  questIconDone: {
    backgroundColor: '#d4f5d0',
  },
  questIconText: {
    fontSize: 22,
  },
  questInfo: {
    flex: 1,
  },
  questTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  questDescription: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    marginBottom: 6,
  },
  questProgress: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    fontWeight: '600',
  },
  questTrack: {
    backgroundColor: '#f0e8de',
    borderRadius: 6,
    height: 6,
    marginTop: 5,
    overflow: 'hidden',
  },
  questFill: {
    backgroundColor: mobileColors.primary,
    borderRadius: 6,
    height: '100%',
  },
  questCheck: {
    color: mobileColors.success,
    fontSize: 22,
  },
  lockIcon: {
    color: mobileColors.muted,
    fontSize: 22,
  },
  bottomSpace: {
    height: 24,
  },
});

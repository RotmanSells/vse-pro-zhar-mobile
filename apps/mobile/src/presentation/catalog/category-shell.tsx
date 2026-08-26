import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  CategoryListPort,
  CategoryLoadFailureReason,
  CategoryLoadResult,
} from '../../application/catalog/category.ts';
import { loadCategories } from '../../application/catalog/category.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

export type CategoryViewState = { readonly kind: 'loading' } | CategoryLoadResult;

function errorMessage(reason: CategoryLoadFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Категории: адрес backend API не настроен.';
    case 'invalid_response':
      return 'Категории: backend вернул некорректный ответ.';
    case 'timeout':
      return 'Категории: backend не ответил вовремя.';
    case 'network':
      return 'Категории: backend сейчас недоступен.';
    case 'http':
      return 'Категории: backend не смог загрузить данные.';
  }
}

export function MobileCategoryShell({
  categoryPort,
  onSelectCategory,
  selectedCategoryId,
}: {
  readonly categoryPort: CategoryListPort;
  readonly onSelectCategory: (categoryId: string, categoryName: string) => void;
  readonly selectedCategoryId: string | undefined;
}): React.ReactElement {
  const [state, setState] = useState<CategoryViewState>({ kind: 'loading' });

  const applyResult = useCallback(
    (result: CategoryLoadResult): void => {
      setState(result);
      if (result.kind === 'loaded' && result.categories[0] !== undefined) {
        onSelectCategory(result.categories[0].id, result.categories[0].name);
      }
    },
    [onSelectCategory],
  );

  function reload(): void {
    setState({ kind: 'loading' });
    void loadCategories(categoryPort).then(applyResult);
  }

  useEffect(() => {
    let mounted = true;
    void loadCategories(categoryPort).then((result) => {
      if (mounted) applyResult(result);
    });
    return () => {
      mounted = false;
    };
  }, [applyResult, categoryPort]);

  return (
    <View style={styles.container} testID="category-catalog-state">
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>
            Categories
          </Text>
          <Text style={styles.subtitle}>Выберите раздел меню</Text>
        </View>
        <Text style={styles.fireMark}>🔥</Text>
      </View>

      {state.kind === 'loading' ? (
        <View style={[styles.stateCard, styles.loadingCard]} testID="category-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.stateText}>Загружаем категории…</Text>
        </View>
      ) : null}

      {state.kind === 'failure' ? (
        <View style={[styles.stateCard, styles.errorCard]} testID="category-error-state">
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text accessibilityLabel="category-error" style={styles.stateText}>
            {errorMessage(state.reason)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={reload}
            style={({ pressed }) => [styles.retryButton, pressed ? styles.buttonPressed : null]}
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}

      {state.kind === 'loaded' ? (
        state.categories.length === 0 ? (
          <View style={[styles.stateCard, styles.emptyCard]} testID="category-empty-state">
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Категорий пока нет.</Text>
            <Text style={styles.emptyCopy}>Каталог появится после загрузки данных.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.categoryRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            testID="category-list"
          >
            {state.categories.map((category) => {
              const selected = category.id === selectedCategoryId;
              return (
                <Pressable
                  accessibilityHint="Выбирает этот раздел меню"
                  accessibilityLabel={category.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={category.id}
                  onPress={() => onSelectCategory(category.id, category.name)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    selected ? styles.categoryChipSelected : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                  testID={`category-${category.id}`}
                >
                  <Text
                    style={[styles.categoryName, selected ? styles.categoryNameSelected : null]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginTop: mobileSpacing.section,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: mobileSpacing.control,
  },
  title: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.sectionTitleSize,
    fontWeight: '800',
  },
  subtitle: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    marginTop: 3,
  },
  fireMark: {
    fontSize: 24,
  },
  stateCard: {
    alignItems: 'center',
    borderRadius: mobileRadii.card,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: mobileSpacing.compact,
    padding: mobileSpacing.card,
  },
  loadingCard: {
    backgroundColor: mobileColors.warningSurface,
  },
  errorCard: {
    backgroundColor: mobileColors.dangerSurface,
  },
  emptyCard: {
    backgroundColor: mobileColors.card,
    flexDirection: 'column',
    ...mobileShadows.card,
  },
  stateText: {
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.bodySize,
  },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadii.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  errorIconText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontWeight: '900',
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
  categoryRow: {
    gap: 10,
    paddingBottom: 4,
  },
  categoryChip: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.chip,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...mobileShadows.card,
  },
  categoryChipSelected: {
    backgroundColor: mobileColors.primary,
    borderColor: mobileColors.primary,
  },
  categoryName: {
    color: '#5a544c',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryNameSelected: {
    color: mobileColors.card,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: mobileSpacing.compact,
  },
  emptyTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: mobileTypography.bodySize,
    fontWeight: '800',
  },
  emptyCopy: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});

export { styles as catalogStyles };

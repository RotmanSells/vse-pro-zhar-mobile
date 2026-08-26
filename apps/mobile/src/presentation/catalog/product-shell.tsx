import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type {
  ProductListPort,
  ProductLoadFailureReason,
  ProductLoadResult,
} from '../../application/catalog/product.ts';
import { loadProducts } from '../../application/catalog/product.ts';
import { catalogStyles } from './category-shell.tsx';
import { mobileColors, mobileSpacing, mobileTypography } from '../ui/tokens.ts';

export type ProductViewState = { readonly kind: 'loading' } | ProductLoadResult;
function errorMessage(reason: ProductLoadFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Блюда: адрес backend API не настроен.';
    case 'invalid_response':
      return 'Блюда: backend вернул некорректный ответ.';
    case 'timeout':
      return 'Блюда: backend не ответил вовремя.';
    case 'network':
      return 'Блюда: backend сейчас недоступен.';
    case 'http':
      return 'Блюда: backend не смог загрузить данные.';
  }
}
function formatRubPrice(basePriceMinor: number): string {
  const rubles = Math.floor(basePriceMinor / 100).toLocaleString('ru-RU');
  const kopecks = String(basePriceMinor % 100).padStart(2, '0');
  return kopecks === '00' ? `${rubles} ₽` : `${rubles},${kopecks} ₽`;
}
export function MobileProductShell({
  productPort,
  selectedCategoryName,
  selectedCategoryId,
}: {
  readonly productPort: ProductListPort;
  readonly selectedCategoryName: string | undefined;
  readonly selectedCategoryId: string | undefined;
}): React.ReactElement {
  const [state, setState] = useState<ProductViewState>({ kind: 'loading' });
  function reload(): void {
    setState({ kind: 'loading' });
    void loadProducts(productPort).then(setState);
  }
  useEffect(() => {
    let mounted = true;
    void loadProducts(productPort).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [productPort]);
  const visibleProducts =
    selectedCategoryId === undefined || state.kind !== 'loaded'
      ? []
      : state.products.filter((product) => product.categoryId === selectedCategoryId);

  return (
    <View style={styles.container} testID="product-catalog-state">
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>
            Блюда
          </Text>
          <Text style={styles.subtitle}>Из меню ресторана</Text>
        </View>
      </View>
      {state.kind === 'loading' ? (
        <View style={[styles.stateCard, styles.loadingCard]} testID="product-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.stateText}>Загружаем блюда…</Text>
        </View>
      ) : null}
      {state.kind === 'failure' ? (
        <View style={[styles.stateCard, styles.errorCard]} testID="product-error-state">
          <Text accessibilityLabel="product-error" style={styles.stateText}>
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
        visibleProducts.length === 0 ? (
          <View style={[styles.stateCard, styles.emptyCard]} testID="product-empty-state">
            <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>
              {selectedCategoryName === undefined
                ? 'Выберите раздел меню.'
                : `В категории «${selectedCategoryName}» пока нет блюд.`}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.categoryRow} testID="product-list">
            {visibleProducts.map((product) => (
              <View
                key={product.id}
                style={[styles.emptyCard, { alignItems: 'stretch', gap: mobileSpacing.compact }]}
                testID={`product-${product.id}`}
              >
                <Text style={styles.emptyTitle}>{product.name}</Text>
                <Text
                  style={[
                    styles.retryButtonText,
                    { fontFamily: mobileTypography.displayFontFamily, fontSize: 16 },
                  ]}
                >
                  {formatRubPrice(product.basePriceMinor)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}
const styles = catalogStyles;

import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

function ProductCardImage({
  imageUrl,
  productName,
}: {
  readonly imageUrl: string;
  readonly productName: string;
}): React.ReactElement {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    <View style={imageStyles.container}>
      {state === 'loading' ? (
        <View style={imageStyles.overlay} testID="product-image-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={imageStyles.stateText}>Загружаем изображение…</Text>
        </View>
      ) : null}
      {state === 'failed' ? (
        <View style={imageStyles.overlay} testID="product-image-error">
          <Text style={imageStyles.stateText}>Изображение временно недоступно.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setState('loading');
              setAttempt((value) => value + 1);
            }}
            style={imageStyles.retryButton}
          >
            <Text style={imageStyles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      <Image
        accessibilityLabel={`Изображение ${productName}`}
        key={`${imageUrl}-${attempt}`}
        onError={() => setState('failed')}
        onLoad={() => setState('loaded')}
        onLoadStart={() => setState('loading')}
        source={{ uri: imageUrl }}
        style={imageStyles.image}
        testID="product-image"
      />
    </View>
  );
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
              <Link asChild href={`/product/${product.id}`} key={product.id}>
                <Pressable
                  accessibilityHint="Открывает детали блюда"
                  accessibilityLabel={`${product.name}, подробнее`}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.emptyCard,
                    { alignItems: 'stretch', gap: mobileSpacing.compact },
                    pressed ? styles.buttonPressed : null,
                  ]}
                  testID={`product-${product.id}`}
                >
                  <Text style={styles.emptyTitle}>{product.name}</Text>
                  {'imageUrl' in product ? (
                    <ProductCardImage imageUrl={product.imageUrl} productName={product.name} />
                  ) : null}
                  <Text
                    style={[
                      styles.retryButtonText,
                      { fontFamily: mobileTypography.displayFontFamily, fontSize: 16 },
                    ]}
                  >
                    {formatRubPrice(product.basePriceMinor)}
                  </Text>
                  <Text style={styles.detailsLink}>Подробнее</Text>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}
const styles = catalogStyles;
const imageStyles = StyleSheet.create({
  container: {
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    borderRadius: 12,
    height: 180,
    width: '100%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: mobileColors.warningSurface,
    borderRadius: 12,
    gap: mobileSpacing.compact,
    justifyContent: 'center',
    minHeight: 180,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  retryButton: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: mobileSpacing.control,
    paddingVertical: mobileSpacing.compact,
  },
  retryText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
  stateText: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
  },
});

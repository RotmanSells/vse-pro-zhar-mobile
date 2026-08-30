import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  loadProductDetails,
  type ProductDetailsLoadFailureReason,
  type ProductDetailsLoadResult,
  type ProductDetailsPort,
} from '../../application/catalog/product.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

type ProductDetailsViewState = { readonly kind: 'loading' } | ProductDetailsLoadResult;

function errorMessage(reason: ProductDetailsLoadFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Блюдо: адрес backend API не настроен.';
    case 'invalid_response':
      return 'Блюдо: backend вернул некорректный ответ.';
    case 'timeout':
      return 'Блюдо: backend не ответил вовремя.';
    case 'network':
      return 'Блюдо: backend сейчас недоступен.';
    case 'http':
      return 'Блюдо: backend не смог загрузить данные.';
    case 'not_found':
      return 'Это блюдо недоступно или больше не существует.';
  }
}

function formatRubPrice(basePriceMinor: number): string {
  const rubles = Math.floor(basePriceMinor / 100).toLocaleString('ru-RU');
  const kopecks = String(basePriceMinor % 100).padStart(2, '0');
  return kopecks === '00' ? `${rubles} ₽` : `${rubles},${kopecks} ₽`;
}

export function MobileProductDetailsShell({
  productId,
  productPort,
}: {
  readonly productId: string;
  readonly productPort: ProductDetailsPort;
}): React.ReactElement {
  const router = useRouter();
  const [state, setState] = useState<ProductDetailsViewState>({ kind: 'loading' });
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const imageUrl =
    state.kind === 'loaded' && 'imageUrl' in state.product ? state.product.imageUrl : undefined;
  const imageStateKey = imageUrl ?? 'no-image';
  const [currentImageStateKey, setCurrentImageStateKey] = useState('no-image');
  const visibleImageState =
    currentImageStateKey === imageStateKey
      ? imageState
      : imageUrl === undefined
        ? 'loaded'
        : 'loading';

  function reload(): void {
    setState({ kind: 'loading' });
    void loadProductDetails(productId, productPort).then(setState);
  }

  useEffect(() => {
    let mounted = true;
    void loadProductDetails(productId, productPort).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [productId, productPort]);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="product-details-state">
      <View style={styles.routeHeader}>
        <Text style={styles.routeLogo}>🔥 Все Про Жар</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад к меню"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}
        >
          <Text style={styles.backButtonText}>← Меню</Text>
        </Pressable>
      </View>
      {state.kind === 'loading' ? (
        <View style={[styles.stateCard, styles.loadingCard]} testID="product-details-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.stateText}>Загружаем блюдо…</Text>
        </View>
      ) : null}
      {state.kind === 'failure' ? (
        <View style={[styles.stateCard, styles.errorCard]} testID="product-details-error-state">
          <Text accessibilityLabel="product-details-error" style={styles.stateText}>
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
        <View style={styles.detailsCard} testID="product-details-loaded">
          {imageUrl === undefined ? null : (
            <View style={styles.imageContainer}>
              {visibleImageState === 'loading' ? (
                <View style={styles.imageLoading} testID="product-image-loading">
                  <ActivityIndicator color={mobileColors.secondary} />
                  <Text style={styles.imageStateText}>Загружаем изображение…</Text>
                </View>
              ) : null}
              {visibleImageState === 'failed' ? (
                <View style={styles.imageFailed} testID="product-image-error">
                  <Text style={styles.imageStateText}>Изображение временно недоступно.</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setCurrentImageStateKey(imageStateKey);
                      setImageState('loading');
                      setImageAttempt((attempt) => attempt + 1);
                    }}
                    style={styles.imageRetryButton}
                  >
                    <Text style={styles.retryButtonText}>Повторить</Text>
                  </Pressable>
                </View>
              ) : null}
              <Image
                accessibilityLabel={`Изображение ${state.product.name}`}
                key={`${imageUrl}-${imageAttempt}`}
                onError={() => {
                  setCurrentImageStateKey(imageStateKey);
                  setImageState('failed');
                }}
                onLoad={() => {
                  setCurrentImageStateKey(imageStateKey);
                  setImageState('loaded');
                }}
                onLoadStart={() => {
                  setCurrentImageStateKey(imageStateKey);
                  setImageState('loading');
                }}
                source={{ uri: imageUrl }}
                style={styles.productImage}
                testID="product-image"
              />
            </View>
          )}
          <Text style={styles.categoryName}>{state.product.categoryName}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {state.product.name}
          </Text>
          <Text style={styles.price}>{formatRubPrice(state.product.basePriceMinor)}</Text>
          <View style={styles.badges}>
            {state.product.isNew ? <Text style={styles.badge}>Новинка</Text> : null}
            {state.product.isHit ? <Text style={styles.badge}>Хит</Text> : null}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Описание и состав</Text>
            <Text style={styles.infoText}>
              {state.product.description ?? 'Описание пока не добавлено.'}
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Вес</Text>
            <Text style={styles.infoText}>
              {state.product.weightGrams === null
                ? 'Вес не указан'
                : `${state.product.weightGrams} г`}
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    paddingBottom: mobileSpacing.screen,
  },
  routeHeader: {
    alignItems: 'center',
    backgroundColor: mobileColors.charcoal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: mobileSpacing.section,
    paddingHorizontal: mobileSpacing.screen,
    paddingVertical: mobileSpacing.control,
  },
  routeLogo: {
    color: mobileColors.secondary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '900',
  },
  backButton: {
    backgroundColor: 'rgba(255,149,0,0.16)',
    borderColor: 'rgba(255,149,0,0.4)',
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    paddingHorizontal: mobileSpacing.control,
    paddingVertical: mobileSpacing.compact,
  },
  backButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
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
  stateText: {
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
  detailsCard: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.card,
    marginHorizontal: mobileSpacing.screen,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  imageContainer: {
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    borderRadius: mobileRadii.card,
    height: 180,
    width: '100%',
  },
  imageLoading: {
    alignItems: 'center',
    backgroundColor: mobileColors.warningSurface,
    borderRadius: mobileRadii.card,
    gap: mobileSpacing.compact,
    justifyContent: 'center',
    minHeight: 180,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  imageFailed: {
    alignItems: 'center',
    backgroundColor: mobileColors.dangerSurface,
    borderRadius: mobileRadii.card,
    gap: mobileSpacing.compact,
    justifyContent: 'center',
    minHeight: 180,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  imageStateText: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
  },
  imageRetryButton: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    paddingHorizontal: mobileSpacing.control,
    paddingVertical: mobileSpacing.compact,
  },
  categoryName: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 26,
    fontWeight: '900',
    marginTop: mobileSpacing.compact,
  },
  price: {
    color: mobileColors.secondary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 22,
    fontWeight: '900',
    marginTop: mobileSpacing.compact,
  },
  badges: {
    flexDirection: 'row',
    gap: mobileSpacing.compact,
    marginTop: mobileSpacing.control,
  },
  badge: {
    backgroundColor: mobileColors.warningSurface,
    borderRadius: mobileRadii.pill,
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoBlock: {
    borderTopColor: mobileColors.border,
    borderTopWidth: 1,
    marginTop: mobileSpacing.section,
    paddingTop: mobileSpacing.control,
  },
  infoLabel: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.captionSize,
    fontWeight: '700',
  },
  infoText: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: mobileTypography.bodySize,
    lineHeight: 22,
    marginTop: mobileSpacing.compact,
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});

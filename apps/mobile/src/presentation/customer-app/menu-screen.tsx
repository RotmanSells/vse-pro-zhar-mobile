import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {
  CategoryListPort,
  CategoryLoadFailureReason,
  CategoryLoadResult,
} from '../../application/catalog/category.ts';
import { loadCategories } from '../../application/catalog/category.ts';
import {
  normalizeCatalogSearchText,
  searchCatalogProducts,
} from '../../application/catalog/catalog-search.ts';
import type {
  MobileProductResponse,
  ProductListPort,
  ProductLoadFailureReason,
  ProductLoadResult,
} from '../../application/catalog/product.ts';
import { loadProducts } from '../../application/catalog/product.ts';
import {
  addProductToCart,
  categoryEmoji,
  formatRubPrice,
  type CartLine,
} from '../../application/customer-experience.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

type CategoryState = { readonly kind: 'loading' } | CategoryLoadResult;
type ProductState = { readonly kind: 'loading' } | ProductLoadResult;

function categoryError(reason: CategoryLoadFailureReason): string {
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

function productError(reason: ProductLoadFailureReason): string {
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

function hasImage(product: MobileProductResponse): product is MobileProductResponse & {
  readonly imageUrl: string;
} {
  return 'imageUrl' in product;
}

function ProductCardImage({
  product,
}: {
  readonly product: MobileProductResponse;
}): React.ReactElement {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
    hasImage(product) ? 'loading' : 'loaded',
  );
  const [attempt, setAttempt] = useState(0);

  if (!hasImage(product)) {
    return (
      <View style={styles.productImagePlaceholder}>
        <Text style={styles.productEmoji}>{categoryEmoji(product.name)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.productImageFrame}>
      <View style={styles.productImagePlaceholder}>
        <Text style={styles.productEmoji}>🔥</Text>
      </View>
      {state === 'loading' ? (
        <View style={styles.imageOverlay} testID="product-image-loading">
          <ActivityIndicator color={mobileColors.card} />
          <Text style={styles.imageOverlayText}>Загрузка…</Text>
        </View>
      ) : null}
      {state === 'failed' ? (
        <View style={styles.imageOverlay} testID="product-image-error">
          <Text style={styles.imageOverlayText}>Изображение недоступно</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setState('loading');
              setAttempt((current) => current + 1);
            }}
            style={styles.imageRetry}
          >
            <Text style={styles.imageRetryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      <Image
        accessibilityLabel={`Изображение ${product.name}`}
        key={`${product.imageUrl}-${attempt}`}
        onError={() => setState('failed')}
        onLoad={() => setState('loaded')}
        onLoadStart={() => setState('loading')}
        source={{ uri: product.imageUrl }}
        style={styles.productImage}
        testID="product-image"
      />
    </View>
  );
}

export function MobileMenuScreen({
  categoryPort,
  productPort,
  cart,
  onCartChange,
}: {
  readonly categoryPort: CategoryListPort;
  readonly productPort: ProductListPort;
  readonly cart: readonly CartLine[];
  readonly onCartChange: (cart: CartLine[]) => void;
}): React.ReactElement {
  const [categoryState, setCategoryState] = useState<CategoryState>({ kind: 'loading' });
  const [productState, setProductState] = useState<ProductState>({ kind: 'loading' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    void loadCategories(categoryPort).then((result) => {
      if (mounted) setCategoryState(result);
    });
    void loadProducts(productPort).then((result) => {
      if (mounted) setProductState(result);
    });
    return () => {
      mounted = false;
    };
  }, [categoryPort, productPort]);

  function reload(): void {
    setCategoryState({ kind: 'loading' });
    setProductState({ kind: 'loading' });
    void loadCategories(categoryPort).then(setCategoryState);
    void loadProducts(productPort).then(setProductState);
  }

  const availableCategories =
    categoryState.kind === 'loaded' && productState.kind === 'loaded'
      ? categoryState.categories.filter((category) =>
          productState.products.some((product) => product.categoryId === category.id),
        )
      : categoryState.kind === 'loaded'
        ? categoryState.categories
        : [];
  const selectedCategoryName = availableCategories.find(
    (category) => category.id === selectedCategoryId,
  )?.name;
  const visibleProducts =
    productState.kind === 'loaded'
      ? searchCatalogProducts(
          productState.products,
          categoryState.kind === 'loaded' ? categoryState.categories : [],
          searchQuery,
          selectedCategoryId,
        )
      : [];
  const searchIsActive = normalizeCatalogSearchText(searchQuery).length > 0;
  const canClearSearch = searchQuery.length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="customer-menu-screen"
    >
      {categoryState.kind === 'loading' ? (
        <View style={styles.stateCard} testID="category-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.stateText}>Загружаем категории…</Text>
        </View>
      ) : null}
      {categoryState.kind === 'failure' ? (
        <View style={[styles.stateCard, styles.errorCard]} testID="category-error-state">
          <Text style={styles.stateText}>{categoryError(categoryState.reason)}</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      {categoryState.kind === 'loaded' ? (
        <ScrollView
          contentContainerStyle={styles.categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="category-list"
        >
          <CategoryChip
            active={selectedCategoryId === 'all'}
            label="Всё"
            emoji="🍴"
            onPress={() => setSelectedCategoryId('all')}
          />
          {availableCategories.map((category) => (
            <CategoryChip
              active={category.id === selectedCategoryId}
              emoji={categoryEmoji(category.name)}
              key={category.id}
              label={category.name}
              onPress={() => setSelectedCategoryId(category.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Поиск блюд"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchQuery}
          placeholder="Поиск блюд"
          placeholderTextColor={mobileColors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          testID="catalog-search-input"
          value={searchQuery}
        />
        <Pressable
          accessibilityLabel="Очистить поиск"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canClearSearch }}
          disabled={!canClearSearch}
          onPress={() => setSearchQuery('')}
          style={({ pressed }) => [
            styles.clearSearchButton,
            !searchIsActive ? styles.clearSearchButtonDisabled : null,
            pressed ? styles.pressed : null,
          ]}
          testID="catalog-search-clear"
        >
          <Text style={styles.clearSearchText}>Очистить</Text>
        </Pressable>
      </View>

      <View style={styles.promo}>
        <View style={styles.promoGlow} />
        <Text style={styles.promoTitle}>🔥 Горячее предложение!</Text>
        <Text style={styles.promoCopy}>Закажите от 1500₽ и крутите рулетку призов</Text>
        <Text style={styles.promoBadge}>🔥</Text>
      </View>

      {productState.kind === 'loading' ? (
        <View style={styles.stateCard} testID="product-loading">
          <ActivityIndicator color={mobileColors.secondary} />
          <Text style={styles.stateText}>Загружаем блюда…</Text>
        </View>
      ) : null}
      {productState.kind === 'failure' ? (
        <View style={[styles.stateCard, styles.errorCard]} testID="product-error-state">
          <Text style={styles.stateText}>{productError(productState.reason)}</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      {productState.kind === 'loaded' && visibleProducts.length === 0 ? (
        <View
          style={styles.emptyCard}
          testID={searchIsActive ? 'product-search-empty-state' : 'product-empty-state'}
        >
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>
            {searchIsActive
              ? 'Ничего не найдено.'
              : selectedCategoryId === 'all'
                ? 'В меню пока нет блюд.'
                : `В категории «${selectedCategoryName ?? 'выбранной'}» пока нет блюд.`}
          </Text>
          <Text style={styles.emptyCopy}>
            {searchIsActive
              ? 'Попробуйте изменить запрос или очистить поиск.'
              : 'Каталог появится после загрузки данных.'}
          </Text>
        </View>
      ) : null}
      {productState.kind === 'loaded' && visibleProducts.length > 0 ? (
        <View style={styles.productGrid} testID="product-list">
          {visibleProducts.map((product) => (
            <ProductCard
              cart={cart}
              key={product.id}
              onAdd={() => onCartChange(addProductToCart(cart, product))}
              product={product}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function CategoryChip({
  active,
  emoji,
  label,
  onPress,
}: {
  readonly active: boolean;
  readonly emoji: string;
  readonly label: string;
  readonly onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${emoji} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryChip,
        active ? styles.categoryChipActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
        {emoji} {label}
      </Text>
    </Pressable>
  );
}

function ProductCard({
  cart,
  onAdd,
  product,
}: {
  readonly cart: readonly CartLine[];
  readonly onAdd: () => void;
  readonly product: MobileProductResponse;
}): React.ReactElement {
  const quantity = cart.find((line) => line.product.id === product.id)?.quantity;
  return (
    <View style={styles.productCard} testID={`product-${product.id}`}>
      <Link asChild href={`/product/${product.id}`}>
        <Pressable
          accessibilityHint="Открывает детали блюда"
          accessibilityLabel={`${product.name}, подробнее`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.productLink, pressed ? styles.pressed : null]}
        >
          <View style={styles.productImageWrap}>
            {product.isHit ? <Text style={[styles.productTag, styles.hitTag]}>🔥 Хит</Text> : null}
            {!product.isHit && product.isNew ? (
              <Text style={[styles.productTag, styles.newTag]}>🆕 Новинка</Text>
            ) : null}
            <ProductCardImage product={product} />
          </View>
          <View style={styles.productBody}>
            <Text numberOfLines={2} style={styles.productName}>
              {product.name}
            </Text>
            <Text numberOfLines={2} style={styles.productDescription}>
              {product.description ?? 'Приготовлено на живом огне'}
            </Text>
          </View>
        </Pressable>
      </Link>
      <View style={styles.productBottom}>
        <Text style={styles.productPrice}>{formatRubPrice(product.basePriceMinor)}</Text>
        <Pressable
          accessibilityLabel={`Добавить ${product.name} в корзину`}
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed ? styles.addButtonPressed : null]}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
        {quantity === undefined ? null : <Text style={styles.quantityBadge}>{quantity}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    paddingTop: mobileSpacing.compact,
  },
  categories: {
    gap: 10,
    paddingBottom: mobileSpacing.compact,
    paddingHorizontal: mobileSpacing.screen,
    paddingTop: mobileSpacing.control,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: mobileSpacing.screen,
    marginVertical: mobileSpacing.compact,
  },
  searchInput: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearSearchButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearSearchButtonDisabled: {
    opacity: 0.5,
  },
  clearSearchText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChip: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.chip,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: mobileColors.primary,
    borderColor: mobileColors.primary,
    ...mobileShadows.fire,
  },
  categoryChipText: {
    color: '#5a544c',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: mobileColors.card,
  },
  promo: {
    backgroundColor: mobileColors.primary,
    borderRadius: 20,
    marginHorizontal: mobileSpacing.screen,
    marginVertical: mobileSpacing.compact,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: 'relative',
    ...mobileShadows.fire,
  },
  promoGlow: {
    backgroundColor: 'rgba(255,149,0,0.75)',
    borderRadius: 120,
    height: 190,
    position: 'absolute',
    right: -70,
    top: -106,
    width: 190,
  },
  promoTitle: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    zIndex: 1,
  },
  promoCopy: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    opacity: 0.95,
    zIndex: 1,
  },
  promoBadge: {
    bottom: -22,
    color: 'rgba(255,255,255,0.25)',
    fontSize: 60,
    position: 'absolute',
    right: -8,
    transform: [{ rotate: '15deg' }],
  },
  productGrid: {
    columnGap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: mobileSpacing.screen,
    rowGap: 14,
  },
  productCard: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.card,
    flexBasis: '47.5%',
    flexGrow: 1,
    maxWidth: '48.5%',
    overflow: 'hidden',
    position: 'relative',
    ...mobileShadows.card,
  },
  productLink: {
    flexGrow: 1,
  },
  productImageWrap: {
    height: 120,
    overflow: 'hidden',
    position: 'relative',
  },
  productImageFrame: {
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  productImage: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  productImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: mobileColors.secondary,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  productEmoji: {
    fontSize: 50,
  },
  imageOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(26,26,26,0.72)',
    gap: 5,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  imageOverlayText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '600',
  },
  imageRetry: {
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.control,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  imageRetryText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
  },
  productTag: {
    borderRadius: mobileRadii.pill,
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    fontWeight: '700',
    left: 8,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
    zIndex: 3,
  },
  hitTag: {
    backgroundColor: mobileColors.accent,
  },
  newTag: {
    backgroundColor: mobileColors.secondary,
  },
  productBody: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 11,
  },
  productName: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  productDescription: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  productBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  productPrice: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 16,
    fontWeight: '800',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: mobileRadii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
    ...mobileShadows.fire,
  },
  addButtonPressed: {
    transform: [{ scale: 0.85 }],
  },
  addButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 25,
  },
  quantityBadge: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.card,
    borderRadius: mobileRadii.pill,
    borderWidth: 2,
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    right: 6,
    textAlign: 'center',
    top: 2,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: mobileColors.warningSurface,
    borderRadius: mobileRadii.card,
    flexDirection: 'row',
    gap: mobileSpacing.compact,
    marginHorizontal: mobileSpacing.screen,
    marginVertical: mobileSpacing.compact,
    padding: mobileSpacing.card,
  },
  errorCard: {
    backgroundColor: mobileColors.dangerSurface,
  },
  stateText: {
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadii.card,
    marginHorizontal: mobileSpacing.screen,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: mobileSpacing.compact,
  },
  emptyTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  bottomSpace: {
    height: 24,
  },
});

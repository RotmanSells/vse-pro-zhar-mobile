import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  calculateCartSummary,
  categoryEmoji,
  changeCartQuantity,
  formatRubPrice,
  removeCartLine,
  type CartLine,
  type DeliveryMode,
} from '../../application/customer-experience.ts';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';

export function MobileCartScreen({
  cart,
  onCartChange,
  onGoToMenu,
}: {
  readonly cart: readonly CartLine[];
  readonly onCartChange: (cart: CartLine[]) => void;
  readonly onGoToMenu: () => void;
}): React.ReactElement {
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('delivery');
  const [promoDraft, setPromoDraft] = useState('');
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [promoMessage, setPromoMessage] = useState<string | undefined>();
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const summary = calculateCartSummary(cart, promoCode, deliveryMode);

  function applyPromo(): void {
    const candidate = promoDraft.trim().toUpperCase();
    if (candidate.length === 0) {
      setPromoMessage('Введите промокод.');
      return;
    }
    const nextSummary = calculateCartSummary(cart, candidate, deliveryMode);
    if (nextSummary.activePromo === undefined) {
      setPromoMessage('Промокод недоступен для этой суммы.');
      return;
    }
    setPromoCode(candidate);
    setPromoDraft('');
    setPromoMessage(`Промокод ${candidate} применён.`);
  }

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="customer-cart-screen">
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          Корзина пуста
        </Text>
        <Text style={styles.emptyCopy}>Добавьте блюда из меню,{`\n`}чтобы оформить заказ!</Text>
        <Pressable accessibilityRole="button" onPress={onGoToMenu} style={styles.checkoutButton}>
          <Text style={styles.checkoutButtonText}>🔥 Перейти в меню</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        testID="customer-cart-screen"
      >
        <Text accessibilityRole="header" style={styles.title}>
          🛒 Моя корзина
        </Text>
        <View style={styles.cartList}>
          {cart.map((line) => (
            <CartItem
              key={line.product.id}
              line={line}
              onDecrease={() => onCartChange(changeCartQuantity(cart, line.product.id, -1))}
              onIncrease={() => onCartChange(changeCartQuantity(cart, line.product.id, 1))}
              onRemove={() => onCartChange(removeCartLine(cart, line.product.id))}
            />
          ))}
        </View>

        <View style={styles.promoInputRow}>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setPromoDraft}
            placeholder="🎁 Введите промокод"
            placeholderTextColor={mobileColors.muted}
            style={styles.promoInput}
            value={promoDraft}
          />
          <Pressable accessibilityRole="button" onPress={applyPromo} style={styles.promoButton}>
            <Text style={styles.promoButtonText}>ОК</Text>
          </Pressable>
        </View>
        {promoMessage === undefined ? null : (
          <Text style={styles.promoMessage}>{promoMessage}</Text>
        )}

        <View style={styles.deliveryTabs}>
          <DeliveryTab
            active={deliveryMode === 'delivery'}
            emoji="🚗"
            label="Доставка"
            onPress={() => setDeliveryMode('delivery')}
          />
          <DeliveryTab
            active={deliveryMode === 'pickup'}
            emoji="🚶"
            label="Самовывоз"
            onPress={() => setDeliveryMode('pickup')}
          />
        </View>

        <View style={styles.summaryCard}>
          <SummaryRow label="Сумма заказа" value={formatRubPrice(summary.subtotalMinor)} />
          {summary.discountMinor > 0 ? (
            <SummaryRow
              label={`Скидка (${summary.activePromo})`}
              value={`−${formatRubPrice(summary.discountMinor)}`}
              accent
            />
          ) : null}
          <SummaryRow
            label="Доставка"
            value={
              deliveryMode === 'pickup'
                ? 'Бесплатно (самовывоз)'
                : summary.deliveryMinor === 0
                  ? 'Бесплатно'
                  : formatRubPrice(summary.deliveryMinor)
            }
            accent={summary.deliveryMinor === 0}
          />
          {deliveryMode === 'delivery' && summary.deliveryMinor > 0 ? (
            <Text style={styles.deliveryHint}>Бесплатно от 2 000₽</Text>
          ) : null}
          <SummaryRow
            label="Кэшбэк Угольками (5%)"
            value={`+${formatRubPrice(summary.cashbackMinor)} 🔥`}
            accent
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Итого</Text>
            <View>
              <Text style={styles.totalValue}>{formatRubPrice(summary.totalMinor)}</Text>
              <Text style={styles.cashback}>
                вернётся +{formatRubPrice(summary.cashbackMinor)} 🔥
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.rouletteHint}>
          {summary.subtotalMinor < 150_000
            ? `🎡 До рулетки осталось ${formatRubPrice(150_000 - summary.subtotalMinor)}`
            : '🎡 Рулетка доступна! Крутите и выигрывайте!'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCheckoutVisible(true)}
          style={styles.checkoutButton}
        >
          <Text style={styles.checkoutButtonText}>🔥 ОФОРМИТЬ ЗАКАЗ</Text>
        </Pressable>
        <View style={styles.bottomSpace} />
      </ScrollView>
      <CheckoutSheet
        deliveryMode={deliveryMode}
        onClose={() => setCheckoutVisible(false)}
        onDeliveryModeChange={setDeliveryMode}
        summary={summary}
        visible={checkoutVisible}
      />
    </>
  );
}

function CartItem({
  line,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  readonly line: CartLine;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly onRemove: () => void;
}): React.ReactElement {
  const imageUrl = 'imageUrl' in line.product ? line.product.imageUrl : undefined;
  return (
    <View style={styles.cartItem}>
      <View style={styles.cartThumb}>
        {imageUrl === undefined ? (
          <Text style={styles.cartEmoji}>{categoryEmoji(line.product.name)}</Text>
        ) : (
          <Image source={{ uri: imageUrl }} style={styles.cartImage} />
        )}
      </View>
      <View style={styles.cartInfo}>
        <Text numberOfLines={1} style={styles.cartName}>
          {line.product.name}
        </Text>
        <Text style={styles.cartPrice}>{formatRubPrice(line.product.basePriceMinor)} / шт</Text>
        <View style={styles.quantityRow}>
          <Pressable
            accessibilityLabel={`Уменьшить ${line.product.name}`}
            accessibilityRole="button"
            onPress={onDecrease}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </Pressable>
          <Text style={styles.quantityValue}>{line.quantity}</Text>
          <Pressable
            accessibilityLabel={`Увеличить ${line.product.name}`}
            accessibilityRole="button"
            onPress={onIncrease}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.cartTotalColumn}>
        <Text style={styles.cartTotal}>
          {formatRubPrice(line.product.basePriceMinor * line.quantity)}
        </Text>
        <Pressable
          accessibilityLabel={`Удалить ${line.product.name}`}
          accessibilityRole="button"
          onPress={onRemove}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DeliveryTab({
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
      onPress={onPress}
      style={[styles.deliveryTab, active ? styles.deliveryTabActive : null]}
    >
      <Text style={styles.deliveryEmoji}>{emoji}</Text>
      <Text style={[styles.deliveryLabel, active ? styles.deliveryLabelActive : null]}>
        {label}
      </Text>
      <Text style={styles.deliveryPrice}>{label === 'Доставка' ? 'от 299₽' : 'бесплатно'}</Text>
    </Pressable>
  );
}

function SummaryRow({
  accent = false,
  label,
  value,
}: {
  readonly accent?: boolean;
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent ? styles.summaryAccent : null]}>{value}</Text>
    </View>
  );
}

function CheckoutSheet({
  deliveryMode,
  onClose,
  onDeliveryModeChange,
  summary,
  visible,
}: {
  readonly deliveryMode: DeliveryMode;
  readonly onClose: () => void;
  readonly onDeliveryModeChange: (mode: DeliveryMode) => void;
  readonly summary: ReturnType<typeof calculateCartSummary>;
  readonly visible: boolean;
}): React.ReactElement {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.checkoutSheet}>
          <View style={styles.checkoutHeader}>
            <Text style={styles.checkoutTitle}>Оформление заказа</Text>
            <Pressable
              accessibilityLabel="Закрыть оформление заказа"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.checkoutBody}
            showsVerticalScrollIndicator={false}
          >
            {confirmed ? (
              <View style={styles.confirmedState}>
                <Text style={styles.confirmedEmoji}>🎉</Text>
                <Text style={styles.confirmedTitle}>Демо-оформление готово</Text>
                <Text style={styles.confirmedCopy}>
                  Реальная отправка заказа будет подключена следующим этапом.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  style={styles.checkoutButton}
                >
                  <Text style={styles.checkoutButtonText}>Отлично! 🔥</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.deliveryTabs}>
                  <DeliveryTab
                    active={deliveryMode === 'delivery'}
                    emoji="🚗"
                    label="Доставка"
                    onPress={() => onDeliveryModeChange('delivery')}
                  />
                  <DeliveryTab
                    active={deliveryMode === 'pickup'}
                    emoji="🚶"
                    label="Самовывоз"
                    onPress={() => onDeliveryModeChange('pickup')}
                  />
                </View>
                <Text style={styles.formTitle}>КОНТАКТЫ</Text>
                <TextInput
                  placeholder="Ваше имя"
                  placeholderTextColor={mobileColors.muted}
                  style={styles.formInput}
                />
                <TextInput
                  keyboardType="phone-pad"
                  placeholder="Номер телефона"
                  placeholderTextColor={mobileColors.muted}
                  style={styles.formInput}
                />
                {deliveryMode === 'delivery' ? (
                  <>
                    <Text style={styles.formTitle}>АДРЕС ДОСТАВКИ</Text>
                    <TextInput
                      placeholder="Улица и дом"
                      placeholderTextColor={mobileColors.muted}
                      style={styles.formInput}
                    />
                    <View style={styles.formRow}>
                      <TextInput
                        placeholder="Кв."
                        placeholderTextColor={mobileColors.muted}
                        style={[styles.formInput, styles.shortInput]}
                      />
                      <TextInput
                        placeholder="Подъезд"
                        placeholderTextColor={mobileColors.muted}
                        style={[styles.formInput, styles.shortInput]}
                      />
                      <TextInput
                        placeholder="Этаж"
                        placeholderTextColor={mobileColors.muted}
                        style={[styles.formInput, styles.shortInput]}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.formTitle}>ТОЧКА САМОВЫВОЗА</Text>
                    {['Все Про Жар — Центр', 'Все Про Жар — Север'].map((point) => (
                      <View key={point} style={styles.pickupPoint}>
                        <Text style={styles.pickupIcon}>🔥</Text>
                        <View style={styles.pickupInfo}>
                          <Text style={styles.pickupName}>{point}</Text>
                          <Text style={styles.pickupAddress}>20–30 мин</Text>
                        </View>
                        <Text style={styles.pickupCheck}>✓</Text>
                      </View>
                    ))}
                  </>
                )}
                <Text style={styles.formTitle}>ВРЕМЯ</Text>
                <View style={styles.timeOptions}>
                  <View style={styles.timeOptionActive}>
                    <Text style={styles.timeOptionTextActive}>Как можно скорее</Text>
                  </View>
                  <View style={styles.timeOption}>
                    <Text style={styles.timeOptionText}>Сегодня, 19:00</Text>
                  </View>
                </View>
                <View style={styles.checkoutSummary}>
                  <SummaryRow label="Итого" value={formatRubPrice(summary.totalMinor)} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmed(true)}
                  style={styles.checkoutButton}
                >
                  <Text style={styles.checkoutButtonText}>🔥 ПОДТВЕРДИТЬ ДЕМО-ЗАКАЗ</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileColors.lightBackground,
    flexGrow: 1,
    padding: mobileSpacing.screen,
  },
  title: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 18,
  },
  cartList: {
    gap: 12,
  },
  cartItem: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    ...mobileShadows.card,
  },
  cartThumb: {
    alignItems: 'center',
    backgroundColor: mobileColors.secondary,
    borderRadius: 12,
    flexShrink: 0,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  cartImage: {
    height: '100%',
    width: '100%',
  },
  cartEmoji: {
    fontSize: 30,
  },
  cartInfo: {
    flex: 1,
    minWidth: 0,
  },
  cartName: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  cartPrice: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    marginTop: 2,
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quantityButton: {
    alignItems: 'center',
    borderColor: mobileColors.border,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  quantityButtonText: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  quantityValue: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  cartTotalColumn: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  cartTotal: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 14,
    fontWeight: '800',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 17,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 18,
  },
  promoInput: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border,
    borderRadius: mobileRadii.control,
    borderWidth: 1.5,
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promoButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.charcoal,
    borderRadius: mobileRadii.control,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  promoButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '700',
  },
  promoMessage: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
  deliveryTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  deliveryTab: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderColor: '#e8e2da',
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  deliveryTabActive: {
    backgroundColor: 'rgba(255,149,0,0.06)',
    borderColor: mobileColors.primary,
  },
  deliveryEmoji: {
    fontSize: 22,
  },
  deliveryLabel: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  deliveryLabelActive: {
    color: mobileColors.primary,
  },
  deliveryPrice: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: mobileColors.card,
    borderRadius: 16,
    marginBottom: 14,
    padding: mobileSpacing.card,
    ...mobileShadows.card,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    color: '#5a544c',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    color: '#5a544c',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
  },
  summaryAccent: {
    color: mobileColors.primary,
    fontWeight: '700',
  },
  deliveryHint: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 11,
    textAlign: 'right',
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: mobileColors.border,
    borderTopWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '800',
  },
  totalValue: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  cashback: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'right',
  },
  rouletteHint: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  checkoutButton: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: mobileRadii.card,
    justifyContent: 'center',
    marginTop: 18,
    padding: 17,
    ...mobileShadows.fire,
  },
  checkoutButtonText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: mobileColors.lightBackground,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 14,
    opacity: 0.5,
  },
  emptyTitle: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCopy: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  bottomSpace: {
    height: 24,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  checkoutSheet: {
    backgroundColor: '#fff8f0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  checkoutHeader: {
    alignItems: 'center',
    backgroundColor: '#fff8f0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  checkoutTitle: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 20,
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  closeButtonText: {
    color: mobileColors.charcoal,
    fontSize: 18,
  },
  checkoutBody: {
    padding: 20,
    paddingBottom: 28,
  },
  formTitle: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  formInput: {
    backgroundColor: mobileColors.card,
    borderColor: '#e8e2da',
    borderRadius: mobileRadii.control,
    borderWidth: 2,
    color: mobileColors.charcoal,
    flex: 1,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 15,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortInput: {
    minWidth: 0,
  },
  pickupPoint: {
    alignItems: 'center',
    backgroundColor: mobileColors.card,
    borderColor: '#e8e2da',
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    padding: 14,
  },
  pickupIcon: {
    fontSize: 24,
  },
  pickupInfo: {
    flex: 1,
  },
  pickupName: {
    color: mobileColors.charcoal,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  pickupAddress: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    marginTop: 2,
  },
  pickupCheck: {
    backgroundColor: mobileColors.primary,
    borderRadius: 11,
    color: mobileColors.card,
    fontSize: 15,
    height: 22,
    paddingTop: 1,
    textAlign: 'center',
    width: 22,
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  timeOption: {
    backgroundColor: mobileColors.card,
    borderColor: '#e8e2da',
    borderRadius: mobileRadii.control,
    borderWidth: 2,
    flex: 1,
    padding: 10,
  },
  timeOptionActive: {
    backgroundColor: 'rgba(255,149,0,0.06)',
    borderColor: mobileColors.primary,
    borderRadius: mobileRadii.control,
    borderWidth: 2,
    flex: 1,
    padding: 10,
  },
  timeOptionText: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    textAlign: 'center',
  },
  timeOptionTextActive: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  checkoutSummary: {
    backgroundColor: 'rgba(255,149,0,0.06)',
    borderRadius: 16,
    marginTop: 18,
    padding: 14,
  },
  confirmedState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  confirmedEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  confirmedTitle: {
    color: mobileColors.primary,
    fontFamily: mobileTypography.displayFontFamily,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmedCopy: {
    color: mobileColors.muted,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});

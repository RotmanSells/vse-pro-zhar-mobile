import type { MobileProductResponse } from './catalog/product.ts';

export type CustomerScreen = 'menu' | 'roulette' | 'passport' | 'cart' | 'profile';
export type DeliveryMode = 'delivery' | 'pickup';

export interface CartLine {
  readonly product: MobileProductResponse;
  readonly quantity: number;
}

export interface CartSummary {
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly deliveryMinor: number;
  readonly totalMinor: number;
  readonly cashbackMinor: number;
  readonly activePromo: string | undefined;
}

export interface RankProgress {
  readonly icon: string;
  readonly name: string;
  readonly xp: number;
  readonly nextRankName: string | undefined;
  readonly nextRankXp: number | undefined;
  readonly percent: number;
}

const MAX_CART_QUANTITY = 99;
const DELIVERY_FREE_THRESHOLD_MINOR = 200_000;
const DELIVERY_COST_MINOR = 29_900;

const prototypePromos = {
  FIRE500: { kind: 'fixed', valueMinor: 50_000, minimumMinor: 200_000 },
  SPARK10: { kind: 'percent', value: 10, minimumMinor: 0 },
  UGOL100: { kind: 'coal', value: 100, minimumMinor: 0 },
} as const;

const ranks = [
  { icon: '🏕️', name: 'Гость у костра', minimumXp: 0 },
  { icon: '🔥', name: 'Разжигатель', minimumXp: 500 },
  { icon: '🍳', name: 'Мастер мангала', minimumXp: 1_500 },
  { icon: '👑', name: 'Повелитель Жара', minimumXp: 3_000 },
] as const;

export function formatRubPrice(basePriceMinor: number): string {
  const rubles = Math.floor(basePriceMinor / 100).toLocaleString('ru-RU');
  const kopecks = basePriceMinor % 100;
  return kopecks === 0 ? `${rubles}₽` : `${rubles},${String(kopecks).padStart(2, '0')}₽`;
}

export function addProductToCart(
  cart: readonly CartLine[],
  product: MobileProductResponse,
): CartLine[] {
  const existing = cart.find((line) => line.product.id === product.id);
  if (existing === undefined) return [...cart, { product, quantity: 1 }];
  return cart.map((line) =>
    line.product.id === product.id
      ? { ...line, quantity: Math.min(MAX_CART_QUANTITY, line.quantity + 1) }
      : line,
  );
}

export function changeCartQuantity(
  cart: readonly CartLine[],
  productId: string,
  delta: number,
): CartLine[] {
  return cart.flatMap((line) => {
    if (line.product.id !== productId) return [line];
    const quantity = Math.min(MAX_CART_QUANTITY, line.quantity + delta);
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}

export function removeCartLine(cart: readonly CartLine[], productId: string): CartLine[] {
  return cart.filter((line) => line.product.id !== productId);
}

export function cartItemCount(cart: readonly CartLine[]): number {
  return cart.reduce((count, line) => count + line.quantity, 0);
}

export function cartSubtotalMinor(cart: readonly CartLine[]): number {
  return cart.reduce((total, line) => total + line.product.basePriceMinor * line.quantity, 0);
}

export function calculateCartSummary(
  cart: readonly CartLine[],
  promoCode: string | undefined,
  deliveryMode: DeliveryMode,
): CartSummary {
  const subtotalMinor = cartSubtotalMinor(cart);
  const normalizedPromo = promoCode?.trim().toUpperCase();
  const promo =
    normalizedPromo === undefined
      ? undefined
      : prototypePromos[normalizedPromo as keyof typeof prototypePromos];
  const promoAvailable = promo !== undefined && subtotalMinor >= promo.minimumMinor;
  const discountMinor =
    promoAvailable && promo.kind === 'percent'
      ? Math.floor((subtotalMinor * promo.value) / 100)
      : promoAvailable && promo.kind === 'fixed'
        ? Math.min(subtotalMinor, promo.valueMinor)
        : 0;
  const deliveryMinor =
    deliveryMode === 'pickup'
      ? 0
      : subtotalMinor >= DELIVERY_FREE_THRESHOLD_MINOR
        ? 0
        : DELIVERY_COST_MINOR;
  const totalMinor = subtotalMinor - discountMinor + deliveryMinor;

  return {
    subtotalMinor,
    discountMinor,
    deliveryMinor,
    totalMinor,
    cashbackMinor: Math.floor((Math.max(0, subtotalMinor - discountMinor) * 5) / 100),
    activePromo: promoAvailable ? normalizedPromo : undefined,
  };
}

export function getRankProgress(xp: number): RankProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  let currentRank: (typeof ranks)[number] = ranks[0];
  let currentIndex = 0;
  ranks.forEach((rank, index) => {
    if (safeXp >= rank.minimumXp) {
      currentRank = rank;
      currentIndex = index;
    }
  });
  const nextRank = ranks[currentIndex + 1];
  if (nextRank === undefined) {
    return {
      icon: currentRank.icon,
      name: currentRank.name,
      xp: safeXp,
      nextRankName: undefined,
      nextRankXp: undefined,
      percent: 100,
    };
  }
  const span = nextRank.minimumXp - currentRank.minimumXp;
  const percent = Math.min(100, Math.max(0, ((safeXp - currentRank.minimumXp) / span) * 100));
  return {
    icon: currentRank.icon,
    name: currentRank.name,
    xp: safeXp,
    nextRankName: nextRank.name,
    nextRankXp: nextRank.minimumXp,
    percent,
  };
}

export function categoryEmoji(name: string): string {
  const normalized = name.toLocaleLowerCase('ru-RU');
  if (normalized.includes('шаш')) return '🥩';
  if (normalized.includes('крыл')) return '🍗';
  if (normalized.includes('кебаб') || normalized.includes('шаурм')) return '🌯';
  if (normalized.includes('салат') || normalized.includes('соус')) return '🥗';
  if (normalized.includes('гарнир')) return '🍟';
  if (normalized.includes('десерт')) return '🍰';
  if (normalized.includes('напит')) return '🍺';
  return '🍴';
}

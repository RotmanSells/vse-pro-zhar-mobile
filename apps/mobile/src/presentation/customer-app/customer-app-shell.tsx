import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CategoryListPort } from '../../application/catalog/category.ts';
import type { ProductListPort } from '../../application/catalog/product.ts';
import {
  cartItemCount,
  cartSubtotalMinor,
  type CartLine,
  type CustomerScreen,
} from '../../application/customer-experience.ts';
import type { CustomerProfilePort } from '../../application/customer-profile.ts';
import type { LegalAcceptancePort } from '../../application/legal-acceptance.ts';
import { DevelopmentIdentityPanel } from '../development-identity-panel.tsx';
import {
  mobileColors,
  mobileRadii,
  mobileShadows,
  mobileSpacing,
  mobileTypography,
} from '../ui/tokens.ts';
import { CustomerHeader } from './customer-header.tsx';
import { MobileCartScreen } from './cart-screen.tsx';
import { MobileMenuScreen } from './menu-screen.tsx';
import { MobilePassportScreen } from './passport-screen.tsx';
import { MobileProfileScreen } from './profile-screen.tsx';
import { MobileRouletteScreen } from './roulette-screen.tsx';

const tabs: readonly {
  readonly screen: CustomerScreen;
  readonly icon: string;
  readonly label: string;
}[] = [
  { icon: '🔥', label: 'Меню', screen: 'menu' },
  { icon: '🎯', label: 'Рулетка', screen: 'roulette' },
  { icon: '🏆', label: 'Паспорт', screen: 'passport' },
  { icon: '🛒', label: 'Корзина', screen: 'cart' },
  { icon: '👤', label: 'Профиль', screen: 'profile' },
];

export function MobileCustomerAppShell({
  categoryPort,
  developmentIdentityEnabled = false,
  legalAcceptancePort,
  productPort,
  profilePort,
}: {
  readonly categoryPort: CategoryListPort;
  readonly developmentIdentityEnabled?: boolean;
  readonly legalAcceptancePort?: LegalAcceptancePort;
  readonly productPort: ProductListPort;
  readonly profilePort?: CustomerProfilePort;
}): React.ReactElement {
  const [screen, setScreen] = useState<CustomerScreen>('menu');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [coal, setCoal] = useState(450);
  const [xp] = useState(450);
  const count = cartItemCount(cart);
  const subtotalMinor = cartSubtotalMinor(cart);
  const developmentPanel = useMemo(() => {
    if (
      !developmentIdentityEnabled ||
      legalAcceptancePort === undefined ||
      profilePort === undefined
    ) {
      return undefined;
    }
    return (
      <DevelopmentIdentityPanel
        enabled
        legalAcceptancePort={legalAcceptancePort}
        profilePort={profilePort}
      />
    );
  }, [developmentIdentityEnabled, legalAcceptancePort, profilePort]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.app}>
        <CustomerHeader coal={coal} onAddCoal={() => setCoal((current) => current + 25)} />
        <View style={styles.content}>
          {screen === 'menu' ? (
            <MobileMenuScreen
              cart={cart}
              categoryPort={categoryPort}
              onCartChange={setCart}
              productPort={productPort}
            />
          ) : null}
          {screen === 'roulette' ? <MobileRouletteScreen cartTotalMinor={subtotalMinor} /> : null}
          {screen === 'passport' ? <MobilePassportScreen xp={xp} /> : null}
          {screen === 'cart' ? (
            <MobileCartScreen
              cart={cart}
              onCartChange={setCart}
              onGoToMenu={() => setScreen('menu')}
            />
          ) : null}
          {screen === 'profile' ? (
            <MobileProfileScreen
              coal={coal}
              {...(developmentPanel === undefined
                ? {}
                : { developmentIdentityPanel: developmentPanel })}
              onOpenPassport={() => setScreen('passport')}
              xp={xp}
            />
          ) : null}
        </View>
        {screen === 'menu' && count > 0 ? (
          <Pressable
            accessibilityLabel={`Открыть корзину, ${count} товаров на ${subtotalMinor / 100} рублей`}
            accessibilityRole="button"
            onPress={() => setScreen('cart')}
            style={({ pressed }) => [
              styles.floatingCart,
              pressed ? styles.floatingCartPressed : null,
            ]}
            testID="floating-cart"
          >
            <Text style={styles.floatingCartText}>
              🛒 {count} · {subtotalMinor / 100}₽
            </Text>
          </Pressable>
        ) : null}
        <BottomNavigation count={count} screen={screen} onSelect={setScreen} />
      </View>
    </SafeAreaView>
  );
}

function BottomNavigation({
  count,
  onSelect,
  screen,
}: {
  readonly count: number;
  readonly onSelect: (screen: CustomerScreen) => void;
  readonly screen: CustomerScreen;
}): React.ReactElement {
  return (
    <View style={styles.tabBar} testID="customer-tabbar">
      {tabs.map((tab) => {
        const active = tab.screen === screen;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={tab.screen}
            onPress={() => onSelect(tab.screen)}
            style={({ pressed }) => [
              styles.tab,
              active ? styles.tabActive : null,
              pressed ? styles.tabPressed : null,
            ]}
            testID={`customer-tab-${tab.screen}`}
          >
            <Text style={[styles.tabIcon, active ? styles.tabIconActive : null]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>
              {tab.label}
            </Text>
            {tab.screen === 'cart' && count > 0 ? (
              <Text style={styles.cartBadge}>{count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: mobileColors.charcoal,
    flex: 1,
  },
  app: {
    backgroundColor: mobileColors.lightBackground,
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  floatingCart: {
    alignSelf: 'flex-end',
    backgroundColor: mobileColors.primary,
    borderRadius: mobileRadii.pill,
    bottom: 86,
    marginRight: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: 'absolute',
    ...mobileShadows.fire,
  },
  floatingCartPressed: {
    transform: [{ scale: 0.96 }],
  },
  floatingCartText: {
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(26,26,26,0.98)',
    borderTopColor: 'rgba(255,149,0,0.2)',
    borderTopWidth: 1,
    flexDirection: 'row',
    height: 78,
    paddingTop: 10,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingVertical: 6,
    position: 'relative',
  },
  tabActive: {
    borderTopColor: mobileColors.secondary,
    borderTopWidth: 3,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabIcon: {
    color: '#7a7068',
    fontSize: 20,
  },
  tabIconActive: {
    color: mobileColors.primary,
  },
  tabLabel: {
    color: '#7a7068',
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10.5,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: mobileColors.secondary,
  },
  cartBadge: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.charcoal,
    borderRadius: 9,
    borderWidth: 2,
    color: mobileColors.card,
    fontFamily: mobileTypography.bodyFontFamily,
    fontSize: 10,
    fontWeight: '700',
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: 'absolute',
    right: '28%',
    textAlign: 'center',
    top: 0,
  },
  bottomSpace: {
    height: mobileSpacing.compact,
  },
});

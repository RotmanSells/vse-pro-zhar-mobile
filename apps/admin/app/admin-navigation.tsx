'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavigationItem = {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
};

export const ADMIN_NAVIGATION: readonly NavigationItem[] = [
  { href: '/', icon: '◒', label: 'Дашборд' },
  { href: '/orders', icon: '▤', label: 'Заказы' },
  { href: '/menu', icon: '♨', label: 'Меню' },
  { href: '/promos', icon: '◇', label: 'Промокоды' },
  { href: '/customers', icon: '◎', label: 'Клиенты' },
  { href: '/loyalty', icon: '✦', label: 'Лояльность' },
  { href: '/quests', icon: '◉', label: 'Квесты' },
  { href: '/wheel', icon: '◌', label: 'Колесо' },
  { href: '/segments', icon: '▦', label: 'Сегменты' },
  { href: '/messages', icon: '➤', label: 'Рассылки' },
];

export default function AdminNavigation(): React.ReactElement {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const currentItem =
    ADMIN_NAVIGATION.find(({ href }) =>
      href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
    ) ?? ADMIN_NAVIGATION[0];

  function closeNavigation(): void {
    setIsOpen(false);
  }

  return (
    <>
      <div className="admin-mobile-topbar">
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Закрыть навигацию' : 'Открыть навигацию'}
          className="admin-menu-toggle"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">{isOpen ? '×' : '☰'}</span>
        </button>
        <span className="admin-mobile-brand">
          <span aria-hidden="true">🔥</span> Все Про Жар
        </span>
        <span className="admin-mobile-page-name">{currentItem?.label ?? 'Дашборд'}</span>
      </div>
      <button
        aria-label="Закрыть навигацию"
        className={`admin-sidebar-backdrop${isOpen ? ' is-visible' : ''}`}
        onClick={closeNavigation}
        type="button"
      />
      <aside
        aria-label="Навигация администратора"
        className={`admin-sidebar${isOpen ? ' is-open' : ''}`}
      >
        <Link className="admin-brand" href="/" onClick={closeNavigation}>
          <span aria-hidden="true">🔥</span>
          <span>VPZ Admin</span>
        </Link>
        <nav className="admin-nav">
          {ADMIN_NAVIGATION.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className="admin-nav-item"
                href={item.href}
                key={item.href}
                onClick={closeNavigation}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-boundary-dot" />
          <span>Development / test boundary</span>
        </div>
      </aside>
    </>
  );
}

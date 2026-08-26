import type { ReactNode } from 'react';

import './globals.css';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="admin-shell">
          <aside aria-label="Навигация администратора" className="admin-sidebar">
            <a className="admin-brand" href="/">
              <span aria-hidden="true">🔥</span>
              <span>Все Про Жар</span>
            </a>
            <nav className="admin-nav">
              <a className="admin-nav-item" href="/">
                <span aria-hidden="true">⌂</span>
                <span>Главная</span>
              </a>
              <a className="admin-nav-item" href="/menu">
                <span aria-hidden="true">☰</span>
                <span>Меню</span>
              </a>
            </nav>
            <div className="admin-sidebar-footer">Интерфейс разработки / тестирования</div>
          </aside>
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}

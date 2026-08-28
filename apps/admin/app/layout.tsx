import type { ReactNode } from 'react';

import AdminNavigation from './admin-navigation';
import './globals.css';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <div className="admin-shell">
          <AdminNavigation />
          <main className="admin-main">{children}</main>
        </div>
      </body>
    </html>
  );
}

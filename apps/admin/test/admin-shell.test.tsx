import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('../app/globals.css', () => ({}));

import RootLayout from '../app/layout';
import AdminPage from '../app/page';

describe('Admin shell', () => {
  it('renders the root layout and initial page', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <AdminPage />
      </RootLayout>,
    );

    expect(markup).toContain('<html lang="ru">');
    expect(markup).toContain('<h1>Админ-панель</h1>');
    expect(markup).toContain('Админ-панель готова к работе.');
    expect(markup).toContain('class="hero-card"');
    expect(markup).toContain('class="admin-shell"');
    expect(markup).toContain('aria-label="Навигация администратора"');
    expect(markup).toContain('href="/menu"');
  });
});

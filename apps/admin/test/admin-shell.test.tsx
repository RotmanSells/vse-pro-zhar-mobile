import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('../app/globals.css', () => ({}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));
jest.mock('../app/menu/category-actions', () => ({
  listCategoriesAction: jest.fn().mockResolvedValue({ kind: 'loaded', categories: [] }),
}));
jest.mock('../app/menu/product-actions', () => ({
  listProductsAction: jest.fn().mockResolvedValue({ kind: 'loaded', products: [] }),
}));

import RootLayout from '../app/layout';
import AdminPage from '../app/page';

describe('Admin shell', () => {
  it('renders the root layout and initial page', async () => {
    const page = await AdminPage();
    const markup = renderToStaticMarkup(<RootLayout>{page}</RootLayout>);

    expect(markup).toContain('<html lang="ru">');
    expect(markup).toContain('<h1 class="page-title">Дашборд</h1>');
    expect(markup).toContain('Меню под контролем');
    expect(markup).toContain('class="hero-card"');
    expect(markup).toContain('class="admin-shell"');
    expect(markup).toContain('aria-label="Навигация администратора"');
    expect(markup).toContain('href="/menu"');
    expect(markup).toContain('href="/orders"');
    expect(markup).toContain('href="/loyalty"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Нет Backend-метрики');
  });
});

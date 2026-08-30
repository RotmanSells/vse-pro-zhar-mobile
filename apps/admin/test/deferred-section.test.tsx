import { renderToStaticMarkup } from 'react-dom/server';

import DeferredSectionPage from '../app/[section]/page';

describe('Deferred Admin sections', () => {
  it('renders the Orders boundary as a non-mutating iiko-owned placeholder', async () => {
    const markup = renderToStaticMarkup(
      await DeferredSectionPage({ params: Promise.resolve({ section: 'orders' }) }),
    );

    expect(markup).toContain('<h1 class="page-title">Заказы</h1>');
    expect(markup).toContain('Источник данных');
    expect(markup).toContain('Backend + iiko');
    expect(markup).toContain('Только просмотр и диагностика');
    expect(markup).toContain('Ручное изменение статуса заказа в Admin не отображается.');
    expect(markup).toContain('Ожидает контракт');
    expect(markup).not.toContain('Новый заказ');
  });

  it('renders another documented destination without inventing rows', async () => {
    const markup = renderToStaticMarkup(
      await DeferredSectionPage({ params: Promise.resolve({ section: 'promos' }) }),
    );

    expect(markup).toContain('<h1 class="page-title">Промокоды</h1>');
    expect(markup).toContain('Источник данных');
    expect(markup).toContain('Backend');
    expect(markup).toContain('Данные ещё не подключены');
    expect(markup).not.toContain('SPARK10');
  });
});

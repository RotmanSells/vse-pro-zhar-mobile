import { renderToStaticMarkup } from 'react-dom/server';

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
    expect(markup).toContain('<h1>Admin</h1>');
    expect(markup).toContain('Admin shell is ready.');
  });
});

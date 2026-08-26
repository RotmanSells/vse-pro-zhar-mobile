import { renderToStaticMarkup } from 'react-dom/server';

import AdminPage from '../app/page';

describe('Admin shell', () => {
  it('renders the root layout and initial page', () => {
    const markup = renderToStaticMarkup(<AdminPage />);

    expect(markup).toContain('<h1>Admin</h1>');
    expect(markup).toContain('Admin shell is ready.');
    expect(markup).toContain('class="hero-card"');
  });
});

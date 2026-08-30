import { render } from '@testing-library/react-native';

import { MobileShell } from '../src/app/index';

describe('MobileShell', () => {
  it('renders the initial application shell', async () => {
    const view = await render(<MobileShell />);

    expect(view.getByRole('header', { name: 'Все Про Жар' })).toBeOnTheScreen();
    expect(view.getByText('🔥 Горячее предложение!')).toBeOnTheScreen();
    expect(view.getByTestId('customer-tabbar')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Меню' })).toBeOnTheScreen();
  });
});

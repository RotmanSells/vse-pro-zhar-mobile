import { fireEvent, render } from '@testing-library/react-native';

import { DevelopmentIdentityPanel } from '../src/presentation/development-identity-panel.tsx';

describe('DevelopmentIdentityPanel', () => {
  it('keeps the development/test path unavailable when the guard is disabled', async () => {
    const view = await render(<DevelopmentIdentityPanel enabled={false} />);

    expect(view.queryByTestId('development-identity-panel')).toBeNull();
    expect(view.queryByText('Тестовый вход')).toBeNull();
  });

  it('shows the test-only flow and creates local development identity state', async () => {
    const view = await render(<DevelopmentIdentityPanel enabled />);

    expect(view.getByText('Тестовый вход')).toBeOnTheScreen();
    expect(
      view.getByText('development identity — не настоящая SMS-аутентификация.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), '+7 900 000-00-00');
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(view.getByTestId('development-identity-state')).toHaveTextContent(
      'Development identity создана для +7 900 000-00-00',
    );
  });
});

jest.mock('expo-router', () => ({ Stack: 'Stack' }));

import { render } from '@testing-library/react-native';

import RootLayout from '../src/app/_layout';

describe('RootLayout', () => {
  it('renders the router stack without a header', async () => {
    const view = await render(<RootLayout />);

    expect(view.toJSON()).toMatchObject({
      props: { screenOptions: { headerShown: false } },
      type: 'Stack',
    });
  });
});

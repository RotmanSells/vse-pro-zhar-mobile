import type { CustomerProfileResponse } from '@vse-pro-zhar/contracts';
import { fireEvent, render } from '@testing-library/react-native';

import type { CustomerProfilePort } from '../src/application/customer-profile.ts';
import { DevelopmentIdentityPanel } from '../src/presentation/development-identity-panel.tsx';

const profile: CustomerProfileResponse = {
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  phone: '+7 900 000-00-00',
  name: 'Иван',
  birthday: '1990-02-03',
  createdAt: '2026-08-23T09:00:00.000Z',
  updatedAt: '2026-08-23T09:00:00.000Z',
};

const successfulProfilePort: CustomerProfilePort = {
  getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'profile', profile }),
  updateCurrentProfile: jest.fn().mockResolvedValue({ kind: 'profile', profile }),
};

describe('DevelopmentIdentityPanel', () => {
  it('keeps the development/test path unavailable when the guard is disabled', async () => {
    const view = await render(
      <DevelopmentIdentityPanel enabled={false} profilePort={successfulProfilePort} />,
    );

    expect(view.queryByTestId('development-identity-panel')).toBeNull();
    expect(view.queryByText('Тестовый вход')).toBeNull();
  });

  it('shows loading and then the explicitly test-only backend profile state', async () => {
    let resolveProfile:
      ((value: Awaited<ReturnType<CustomerProfilePort['getCurrentProfile']>>) => void) | undefined;
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
      ),
      updateCurrentProfile: jest.fn(),
    };
    const view = await render(<DevelopmentIdentityPanel enabled profilePort={profilePort} />);

    expect(view.getByText('Тестовый вход')).toBeOnTheScreen();
    expect(
      view.getByText('development identity — не настоящая SMS-аутентификация.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), '+7 900 000-00-00');
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(view.getByTestId('development-profile-loading')).toHaveTextContent(
      'Подключаем development identity к backend…',
    );

    resolveProfile?.({ kind: 'profile', profile });

    expect(await view.findByText('Test identity подключена к backend')).toBeOnTheScreen();
    expect(view.getByText('Телефон: +7 900 000-00-00')).toBeOnTheScreen();
    expect(view.getByText('Имя: Иван')).toBeOnTheScreen();
    expect(view.getByText('Дата рождения: 1990-02-03')).toBeOnTheScreen();
  });

  it('shows a safe backend error and retries without treating it as connected', async () => {
    const getCurrentProfile = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'failure', reason: 'unauthorized' })
      .mockResolvedValueOnce({ kind: 'profile', profile });
    const profilePort: CustomerProfilePort = {
      getCurrentProfile,
      updateCurrentProfile: jest.fn(),
    };
    const view = await render(<DevelopmentIdentityPanel enabled profilePort={profilePort} />);

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), profile.phone);
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(await view.findByText('Backend отклонил development identity.')).toBeOnTheScreen();
    expect(view.queryByTestId('development-profile-connected')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Повторить' }));

    expect(await view.findByTestId('development-profile-connected')).toBeOnTheScreen();
    expect(getCurrentProfile).toHaveBeenCalledTimes(2);
  });

  it('clears a stale error after editing the phone and continues with the new identity', async () => {
    const phoneA = '+7 900 000-00-00';
    const phoneB = '+7 911 111-11-11';
    const profileB: CustomerProfileResponse = { ...profile, phone: phoneB };
    const getCurrentProfile = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'failure', reason: 'unauthorized' })
      .mockResolvedValueOnce({ kind: 'profile', profile: profileB });
    const profilePort: CustomerProfilePort = {
      getCurrentProfile,
      updateCurrentProfile: jest.fn(),
    };
    const view = await render(<DevelopmentIdentityPanel enabled profilePort={profilePort} />);

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), phoneA);
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(await view.findByTestId('development-profile-error')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Повторить' })).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), phoneB);

    expect(view.queryByTestId('development-profile-error')).toBeNull();
    expect(view.queryByRole('button', { name: 'Повторить' })).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(await view.findByText(`Телефон: ${phoneB}`)).toBeOnTheScreen();
    expect(getCurrentProfile).toHaveBeenNthCalledWith(1, {
      kind: 'development_identity',
      phone: phoneA,
    });
    expect(getCurrentProfile).toHaveBeenNthCalledWith(2, {
      kind: 'development_identity',
      phone: phoneB,
    });
  });

  it('hides a stale connected profile after editing the phone', async () => {
    const phoneB = '+7 911 111-11-11';
    const view = await render(
      <DevelopmentIdentityPanel enabled profilePort={successfulProfilePort} />,
    );

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), profile.phone);
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));

    expect(await view.findByTestId('development-profile-connected')).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), phoneB);

    expect(view.queryByTestId('development-profile-connected')).toBeNull();
    expect(view.queryByText(`Телефон: ${profile.phone}`)).toBeNull();
  });

  it('edits name and birthday and displays the exact backend-returned saved profile', async () => {
    const updatedProfile: CustomerProfileResponse = {
      ...profile,
      birthday: '1991-04-05',
      name: 'Имя от backend',
      updatedAt: '2026-08-23T10:00:00.000Z',
    };
    let resolveUpdate:
      | ((value: Awaited<ReturnType<CustomerProfilePort['updateCurrentProfile']>>) => void)
      | undefined;
    const updateCurrentProfile = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'profile', profile }),
      updateCurrentProfile,
    };
    const view = await render(<DevelopmentIdentityPanel enabled profilePort={profilePort} />);

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), profile.phone);
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));
    expect(await view.findByTestId('development-profile-connected')).toBeOnTheScreen();

    await fireEvent.changeText(view.getByTestId('development-profile-name'), '  Новое имя  ');
    await fireEvent.changeText(view.getByTestId('development-profile-birthday'), '1991-04-05');
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить профиль' }));

    expect(view.getByTestId('development-profile-saving')).toHaveTextContent(
      'Сохраняем профиль в backend…',
    );
    resolveUpdate?.({ kind: 'profile', profile: updatedProfile });

    expect(await view.findByText('Профиль сохранён в backend')).toBeOnTheScreen();
    expect(view.getByText('Имя: Имя от backend')).toBeOnTheScreen();
    expect(view.getByText('Дата рождения: 1991-04-05')).toBeOnTheScreen();
    expect(updateCurrentProfile).toHaveBeenCalledWith(
      { kind: 'development_identity', phone: profile.phone },
      { birthday: '1991-04-05', name: 'Новое имя' },
    );
  });

  it('shows save failure, retains the confirmed profile and retries the current draft', async () => {
    const updatedProfile: CustomerProfileResponse = {
      ...profile,
      birthday: null,
      name: 'Backend retry',
      updatedAt: '2026-08-23T10:00:00.000Z',
    };
    const updateCurrentProfile = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'failure', reason: 'http' })
      .mockResolvedValueOnce({ kind: 'profile', profile: updatedProfile });
    const profilePort: CustomerProfilePort = {
      getCurrentProfile: jest.fn().mockResolvedValue({ kind: 'profile', profile }),
      updateCurrentProfile,
    };
    const view = await render(<DevelopmentIdentityPanel enabled profilePort={profilePort} />);

    await fireEvent.changeText(view.getByTestId('development-identity-phone'), profile.phone);
    await fireEvent.press(view.getByRole('button', { name: 'Продолжить' }));
    expect(await view.findByTestId('development-profile-connected')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByTestId('development-profile-name'), 'Backend retry');
    await fireEvent.changeText(view.getByTestId('development-profile-birthday'), '');
    await fireEvent.press(view.getByRole('button', { name: 'Сохранить профиль' }));

    expect(await view.findByTestId('development-profile-save-error')).toBeOnTheScreen();
    expect(view.getByText('Имя: Иван')).toBeOnTheScreen();
    expect(view.queryByText('Профиль сохранён в backend')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Повторить сохранение' }));

    expect(await view.findByText('Профиль сохранён в backend')).toBeOnTheScreen();
    expect(view.getByText('Имя: Backend retry')).toBeOnTheScreen();
    expect(updateCurrentProfile).toHaveBeenCalledTimes(2);
  });
});

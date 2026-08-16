import { getAdminShellModel } from './admin-shell-model';

describe('getAdminShellModel', () => {
  it('describes the M1 Admin shell without business capability', () => {
    expect(getAdminShellModel()).toEqual({
      heading: 'Все Про Жар — Admin',
      message: 'Operational shell is running. Business capabilities are not part of M1.',
    });
  });
});

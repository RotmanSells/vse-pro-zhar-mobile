export interface AdminShellModel {
  readonly heading: string;
  readonly message: string;
}

export function getAdminShellModel(): AdminShellModel {
  return {
    heading: 'Все Про Жар — Admin',
    message: 'Operational shell is running. Business capabilities are not part of M1.',
  };
}

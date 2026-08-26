export function readConfiguredAdminApiBaseUrl(
  value: unknown = process.env.VPZH_ADMIN_API_BASE_URL,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return undefined;
    }
    return value.replace(/\/$/u, '');
  } catch {
    return undefined;
  }
}

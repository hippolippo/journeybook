/** Only allow same-app absolute paths as post-login redirects. */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

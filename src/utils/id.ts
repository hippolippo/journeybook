/** PocketBase-compatible id: 15 chars of [a-z0-9]. */
export function newId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return raw.slice(0, 15).padEnd(15, '0');
}

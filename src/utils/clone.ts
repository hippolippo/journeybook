/** Deep-clone plain JSON data (safe for Pinia state, which is reactive/proxied). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

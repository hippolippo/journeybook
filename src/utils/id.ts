const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * PocketBase-compatible id: 15 chars of [a-z0-9]. Uses the platform CSPRNG when
 * available to keep collisions effectively impossible across the two devices.
 */
export function newId(): string {
  const bytes = new Uint8Array(15);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

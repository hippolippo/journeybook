/** Default day glow strength; matches the original fixed halo. */
export const DEFAULT_ROOM_GLOW = 0.92;

/** Browser-local fallback when no PocketBase user is signed in. */
export const LOCAL_ROOM_GLOW_KEY = 'journeybook:room-glow';

/** Clamp a glow preference to the 0 (none) – 1 (solid) range. */
export function clampRoomGlow(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ROOM_GLOW;
  return Math.min(1, Math.max(0, value));
}

/** Parse the PocketBase text field; an empty value means "use the default". */
export function parseRoomGlow(value: unknown): number {
  if (typeof value === 'string') {
    if (!value.trim()) return DEFAULT_ROOM_GLOW;
    return clampRoomGlow(Number(value));
  }
  return clampRoomGlow(value);
}

/** Read the local-mode / signed-out glow fallback. */
export function loadLocalRoomGlow(): number {
  try {
    const raw = localStorage.getItem(LOCAL_ROOM_GLOW_KEY);
    return raw === null ? DEFAULT_ROOM_GLOW : clampRoomGlow(Number(raw));
  } catch {
    return DEFAULT_ROOM_GLOW;
  }
}

/** Persist the local-mode / signed-out glow fallback. */
export function saveLocalRoomGlow(value: number): void {
  try {
    localStorage.setItem(LOCAL_ROOM_GLOW_KEY, String(clampRoomGlow(value)));
  } catch {
    /* Preferences are best-effort; the UI keeps the in-memory value. */
  }
}

import type { EventKind, Recurrence, UserRole, VisitDirection } from '@/data/types';

export interface KindMeta {
  label: string;
  icon: string;
  color: string;
}

export const KIND_META: Record<EventKind, KindMeta> = {
  visit: { label: 'Visit', icon: 'icon--plane', color: 'var(--rose)' },
  anniversary: { label: 'Anniversary', icon: 'icon--gift', color: 'var(--terracotta)' },
  birthday: { label: 'Birthday', icon: 'icon--gift', color: 'var(--mustard)' },
  occasion: { label: 'Occasion', icon: 'icon--calendar', color: 'var(--sky)' },
};

export const EVENT_KINDS: EventKind[] = ['visit', 'anniversary', 'birthday', 'occasion'];

export const DIRECTION_LABEL: Record<VisitDirection, string> = {
  'to-her': 'I go to her',
  'to-me': 'She comes to me',
  together: 'Traveling together',
};

export const DIRECTIONS: VisitDirection[] = ['to-her', 'to-me', 'together'];

export interface DirectionContext {
  myRole: UserRole | null;
  myName: string;
  partnerName: string;
}

/**
 * Perspective-aware label so a visit reads correctly for whoever is viewing:
 * `to-her` is travel toward the woman, `to-me` toward the man. Falls back to
 * the generic labels when the viewer's role is unknown.
 */
export function directionLabel(direction: VisitDirection, ctx: DirectionContext): string {
  if (direction === 'together') return 'Traveling together';
  const { myRole, myName, partnerName } = ctx;
  if (!myRole) return DIRECTION_LABEL[direction];
  const himName = myRole === 'him' ? myName : partnerName;
  const herName = myRole === 'her' ? myName : partnerName;
  if (direction === 'to-her') {
    return myRole === 'him' ? `I go to ${herName || 'her'}` : `${himName || 'He'} comes to me`;
  }
  return myRole === 'him' ? `${herName || 'She'} comes to me` : `I go to ${himName || 'him'}`;
}

export function directionOptions(
  ctx: DirectionContext,
): { value: VisitDirection; label: string }[] {
  return DIRECTIONS.map((value) => ({ value, label: directionLabel(value, ctx) }));
}

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'One-time' },
  { value: 'yearly', label: 'Every year' },
  { value: 'monthly', label: 'Every month' },
  { value: 'weekly', label: 'Every week' },
];

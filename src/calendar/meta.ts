import type { EventKind, Recurrence, VisitDirection } from '@/data/types';

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

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'One-time' },
  { value: 'yearly', label: 'Every year' },
  { value: 'monthly', label: 'Every month' },
  { value: 'weekly', label: 'Every week' },
];

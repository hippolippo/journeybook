/**
 * Tiny framework-agnostic notification bus. UI surfaces (e.g. ToastHost) and
 * the data layer (e.g. the write outbox) talk through this, avoiding a
 * circular dependency on Pinia before the app is mounted.
 */
export type NoticeKind = 'info' | 'success' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
  detail?: string;
}

export interface SyncStatus {
  pending: number;
  working: boolean;
  failed: boolean;
}

type NoticeListener = (notice: Notice) => void;
type StatusListener = (status: SyncStatus) => void;

const noticeListeners = new Set<NoticeListener>();
const statusListeners = new Set<StatusListener>();
let seq = 0;

export function notify(kind: NoticeKind, message: string, detail?: string): number {
  const notice: Notice = { id: ++seq, kind, message, detail };
  for (const listener of noticeListeners) listener(notice);
  return notice.id;
}

export function onNotice(listener: NoticeListener): () => void {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}

export function reportSync(status: SyncStatus): void {
  for (const listener of statusListeners) listener(status);
}

export function onSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

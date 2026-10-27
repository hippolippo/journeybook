import { defineStore } from 'pinia';
import type { Note } from '@/data/types';
import { backend, pbEnabled, pbOutbox } from '@/data/backend';
import { useAppStore } from './app';
import { useAuthStore } from './auth';
import { auditNotes } from '@/data/integrity';
import { readRemoteSnapshot, updateRemoteSnapshot } from '@/data/snapshot';
import { clone } from '@/utils/clone';
import { newId } from '@/utils/id';
import { notify } from '@/utils/notify';
import { DEFAULT_ENVELOPE, normalizeEnvelope } from '@/notes/envelope';
import { clampPageHeight, NOTE_DEFAULT_HEIGHT } from '@/notes/page';
import { cloneEmpty, docPreview, normalizeDoc, toHex } from '@/notes/richText';
import { notePaperById } from '@/scrapbook/notes';

const LOCAL_AUTHOR = 'local';
const LOCAL_RECIPIENT = 'partner';
const SAVE_DELAY = 450;

let refreshTimer: number | undefined;
let refreshInFlight = false;
let refreshQueued = false;
const saveTimers = new Map<string, number>();

function myId(): string {
  if (!pbEnabled) return LOCAL_AUTHOR;
  return useAuthStore().user?.id ?? '';
}

function partnerId(): string {
  if (!pbEnabled) return LOCAL_RECIPIENT;
  return useAuthStore().partner?.id ?? '';
}

function partnerName(): string {
  if (!pbEnabled) return 'your person';
  return useAuthStore().partnerName || 'your person';
}

/** The wax seal carries the author's first initial; local mode uses G. */
function myInitial(): string {
  if (!pbEnabled) return 'G';
  const name = useAuthStore().myName.trim();
  return (Array.from(name)[0] ?? 'G').toUpperCase();
}

function normalizeNote(value: unknown): Note | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.id !== 'string' || !source.id) return null;
  const authorId = typeof source.authorId === 'string' ? source.authorId : '';
  const recipientId = typeof source.recipientId === 'string' ? source.recipientId : '';
  if (!authorId || !recipientId) return null;
  const paper = notePaperById(typeof source.paper === 'string' ? source.paper : undefined);
  return {
    id: source.id,
    authorId,
    recipientId,
    status: source.status === 'sent' ? 'sent' : 'draft',
    body: normalizeDoc(source.body),
    paper: paper.id === 'none' ? 'lined' : paper.id,
    paperColor: typeof source.paperColor === 'string' ? toHex(source.paperColor) : undefined,
    pageHeight: clampPageHeight(
      typeof source.pageHeight === 'number' ? source.pageHeight : NOTE_DEFAULT_HEIGHT,
    ),
    envelope: normalizeEnvelope(source.envelope),
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : Date.now(),
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : Date.now(),
    sentAt: typeof source.sentAt === 'number' ? source.sentAt : 0,
    openedAt: typeof source.openedAt === 'number' ? source.openedAt : 0,
    emailedAt: typeof source.emailedAt === 'number' ? source.emailedAt : 0,
    deletedAt:
      typeof source.deletedAt === 'number' && source.deletedAt ? source.deletedAt : undefined,
  };
}

function sortSent(a: Note, b: Note): number {
  return b.sentAt - a.sentAt;
}

function sortDrafts(a: Note, b: Note): number {
  return b.updatedAt - a.updatedAt;
}

function persistNote(note: Note, create = false): void {
  try {
    if (create) backend.noteCreate(clone(note));
    else backend.noteUpdate(clone(note));
  } catch (e) {
    console.error('notes save', e);
    notify('error', "Couldn't save this letter", 'This browser is out of storage space.');
  }
}

function persistOpen(note: Note): void {
  try {
    backend.noteOpen(note.id, note.openedAt);
  } catch (e) {
    console.error('notes open', e);
    notify('error', "Couldn't save this letter", 'This browser is out of storage space.');
  }
}

export const useNotesStore = defineStore('notes', {
  state: () => ({
    notes: [] as Note[],
    loaded: false,
    loading: pbEnabled,
    error: false,
    subscribed: false,
    /** Identity the current list was fetched for (guards account switches). */
    loadedFor: '',
    /** Pause realtime refreshes while a letter is being written. */
    syncPaused: false,
  }),
  getters: {
    meId: () => myId(),
    partnerId: () => partnerId(),
    partnerName: () => partnerName(),
    liveNotes: (s) => s.notes.filter((note) => !note.deletedAt),
    inbox(): Note[] {
      const me = myId();
      return this.liveNotes
        .filter((note) => note.status === 'sent' && note.recipientId === me)
        .sort(sortSent);
    },
    outbox(): Note[] {
      const me = myId();
      return this.liveNotes
        .filter((note) => note.status === 'sent' && note.authorId === me)
        .sort(sortSent);
    },
    drafts(): Note[] {
      const me = myId();
      return this.liveNotes
        .filter((note) => note.status === 'draft' && note.authorId === me)
        .sort(sortDrafts);
    },
    unread(): number {
      return this.inbox.filter((note) => !note.openedAt).length;
    },
    noteById: (s) => {
      return (id: string): Note | undefined => s.notes.find((note) => note.id === id);
    },
    integrity: (s) => {
      const ids = [myId(), partnerId()].filter((id): id is string => Boolean(id));
      if (pbEnabled && ids.length < 2) return { orphanNotes: 0 };
      return auditNotes(s.notes, ids);
    },
  },
  actions: {
    /** Load notes for the signed-in user (or the local development identity). */
    async init(force = false) {
      if (pbEnabled && !useAuthStore().isAuthed) {
        this.reset();
        return;
      }
      if (!force && this.loaded && this.loadedFor === myId()) return;
      if (!this.subscribed) {
        backend.subscribeNotes(() => this.scheduleRefresh());
        this.subscribed = true;
      }
      this.loading = true;
      this.error = false;
      try {
        const notes = (await backend.fetchNotes())
          .map(normalizeNote)
          .filter((note): note is Note => !!note);
        this.notes = notes;
        this.loaded = true;
        this.loadedFor = myId();
        if (pbEnabled) updateRemoteSnapshot({ notes, ownerId: myId() });
      } catch (e) {
        console.error('notes init', e);
        const snapshot = readRemoteSnapshot();
        if (snapshot?.notes && snapshot.ownerId === myId()) {
          this.notes = snapshot.notes.map(normalizeNote).filter((note): note is Note => !!note);
          this.loaded = true;
          this.loadedFor = myId();
          this.error = false;
          notify('info', 'Showing the last saved letters');
        } else {
          this.error = true;
          notify('error', "Couldn't open your notes", 'Check your connection and try again.');
        }
      } finally {
        this.loading = false;
      }
    },
    reset() {
      this.notes = [];
      this.loaded = false;
      this.loadedFor = '';
      this.loading = pbEnabled;
      this.error = false;
    },
    scheduleRefresh() {
      if (this.syncPaused) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void this.refresh(), 250);
    },
    async refresh() {
      if (this.syncPaused) return;
      if (pbOutbox && pbOutbox.size() > 0) {
        this.scheduleRefresh();
        return;
      }
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        const notes = (await backend.fetchNotes())
          .map(normalizeNote)
          .filter((note): note is Note => !!note);
        this.notes = notes;
        this.loaded = true;
        this.loadedFor = myId();
        this.error = false;
        if (pbEnabled) updateRemoteSnapshot({ notes, ownerId: myId() });
      } catch (e) {
        console.error('notes refresh', e);
        this.error = true;
      } finally {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          this.scheduleRefresh();
        }
      }
    },
    pauseSync() {
      this.syncPaused = true;
    },
    resumeSync() {
      this.syncPaused = false;
      this.scheduleRefresh();
    },
    createDraft(): Note {
      const now = Date.now();
      const paper = notePaperById('lined');
      const note: Note = {
        id: newId(),
        authorId: myId(),
        recipientId: partnerId(),
        status: 'draft',
        body: cloneEmpty(),
        paper: paper.id === 'none' ? 'lined' : paper.id,
        paperColor: paper.bg,
        pageHeight: NOTE_DEFAULT_HEIGHT,
        envelope: { ...DEFAULT_ENVELOPE, initial: myInitial() },
        createdAt: now,
        updatedAt: now,
        sentAt: 0,
        openedAt: 0,
        emailedAt: 0,
      };
      this.notes.unshift(note);
      persistNote(note, true);
      return note;
    },
    /** Persist immediately. Callers debounce this through `autosave`. */
    saveDraft(noteId: string) {
      const note = this.noteById(noteId);
      if (!note) return;
      if (note.status === 'sent' && note.openedAt) return;
      if (note.status === 'sent' && note.authorId !== myId()) return;
      note.updatedAt = Date.now();
      persistNote(note);
    },
    /** Debounced save while writing. */
    autosave(noteId: string) {
      if (!this.noteById(noteId)) return;
      const existing = saveTimers.get(noteId);
      if (existing) window.clearTimeout(existing);
      saveTimers.set(
        noteId,
        window.setTimeout(() => {
          saveTimers.delete(noteId);
          this.saveDraft(noteId);
        }, SAVE_DELAY),
      );
    },
    flushSave(noteId: string) {
      const existing = saveTimers.get(noteId);
      if (existing) {
        window.clearTimeout(existing);
        saveTimers.delete(noteId);
      }
      this.saveDraft(noteId);
    },
    hasPendingSave(noteId: string): boolean {
      return saveTimers.has(noteId);
    },
    sendNote(noteId: string): Note | null {
      const note = this.noteById(noteId);
      if (!note || note.status !== 'draft' || note.authorId !== myId()) return null;
      if (!note.recipientId) {
        notify('error', 'No one to send to yet', 'Your person needs an account first.');
        return null;
      }
      this.flushSave(noteId);
      note.status = 'sent';
      note.sentAt = Date.now();
      note.updatedAt = note.sentAt;
      note.openedAt = 0;
      note.emailedAt = 0;
      persistNote(note);
      notify('success', `Letter sent to ${partnerName()}`);
      return note;
    },
    unsendNote(noteId: string): boolean {
      const note = this.noteById(noteId);
      if (!note || note.authorId !== myId() || note.status !== 'sent' || note.openedAt)
        return false;
      note.status = 'draft';
      note.sentAt = 0;
      note.openedAt = 0;
      note.emailedAt = 0;
      note.updatedAt = Date.now();
      persistNote(note);
      notify('info', 'Pulled back into your drafts');
      return true;
    },
    markOpened(noteId: string): boolean {
      const note = this.noteById(noteId);
      if (!note || note.status !== 'sent' || note.recipientId !== myId() || note.openedAt)
        return false;
      note.openedAt = Date.now();
      note.updatedAt = note.openedAt;
      persistOpen(note);
      return true;
    },
    trashNote(noteId: string): boolean {
      const note = this.noteById(noteId);
      if (!note || note.authorId !== myId()) return false;
      const now = Date.now();
      note.deletedAt = now;
      const label =
        note.status === 'sent'
          ? `Letter to ${partnerName()}`
          : `Draft: ${docPreview(note.body, 40) || 'Untitled'}`;
      useAppStore().trashRecords(
        'note',
        label,
        [{ collection: 'notes', id: note.id, record: clone(note) }],
        note.status === 'sent' ? 'Sent letter' : 'Draft',
      );
      // PocketBase's trashGroup sets deletedAt server-side; local storage needs
      // the soft-deleted record written here.
      if (!pbEnabled) persistNote(note);
      notify('info', 'Letter moved to the trash');
      return true;
    },
    canEdit(note: Note | undefined): boolean {
      if (!note) return false;
      if (note.authorId !== myId()) return false;
      return note.status === 'draft' || !note.openedAt;
    },
    cleanOrphanNotes(): number {
      const ids = [myId(), partnerId()].filter(Boolean);
      if (pbEnabled && ids.length < 2) return 0;
      const known = new Set(ids);
      const orphans = this.notes.filter(
        (note) => !note.deletedAt && (!known.has(note.authorId) || !known.has(note.recipientId)),
      );
      for (const note of orphans) {
        note.deletedAt = Date.now();
        useAppStore().trashRecords(
          'note',
          docPreview(note.body, 40) || 'Letter',
          [{ collection: 'notes', id: note.id, record: clone(note) }],
          'Missing account',
        );
        if (!pbEnabled) persistNote(note);
      }
      return orphans.length;
    },
  },
});

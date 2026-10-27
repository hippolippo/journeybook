import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useNotesStore } from './notes';
import { useAppStore } from './app';
import { loadNotes } from '@/data/storage';
import { cloneEmpty } from '@/notes/richText';
import { newId } from '@/utils/id';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

describe('notes store (local mode)', () => {
  it('creates a draft, autosaves and lists it', async () => {
    const notes = useNotesStore();
    await notes.init();
    const draft = notes.createDraft();
    expect(draft.status).toBe('draft');
    expect(notes.drafts).toHaveLength(1);
    expect(draft.paper).toBe('lined');
    expect(draft.pageHeight).toBeGreaterThan(0);
    expect(draft.envelope.initial).toBe('G');

    draft.body = { v: 1, blocks: [{ align: 'left', runs: [{ text: 'hello' }] }] };
    notes.saveDraft(draft.id);
    expect(notes.drafts[0].body.blocks[0].runs[0].text).toBe('hello');
    expect(loadNotes()?.[0].body.blocks[0].runs[0].text).toBe('hello');
  });

  it('sends a letter into the outbox and pulls it back while unopened', async () => {
    const notes = useNotesStore();
    await notes.init();
    const draft = notes.createDraft();
    notes.sendNote(draft.id);
    expect(notes.drafts).toHaveLength(0);
    expect(notes.outbox).toHaveLength(1);
    expect(notes.outbox[0].sentAt).toBeGreaterThan(0);
    expect(notes.outbox[0].openedAt).toBe(0);

    expect(notes.unsendNote(draft.id)).toBe(true);
    expect(notes.outbox).toHaveLength(0);
    expect(notes.drafts).toHaveLength(1);
    expect(notes.drafts[0].sentAt).toBe(0);
  });

  it('marks an incoming letter opened for the recipient', async () => {
    const notes = useNotesStore();
    await notes.init();
    const incoming = {
      id: newId(),
      authorId: 'partner',
      recipientId: 'local',
      status: 'sent' as const,
      paper: 'lined',
      paperColor: '#fdf8ef',
      pageHeight: 620,
      envelope: { tint: '#d9b98c', seal: '#D9482F', stamp: 'mint' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sentAt: Date.now(),
      body: cloneEmpty(),
      openedAt: 0,
      emailedAt: 0,
    };
    notes.notes.push(incoming);
    expect(notes.inbox).toHaveLength(1);
    expect(notes.unread).toBe(1);
    expect(notes.markOpened(incoming.id)).toBe(true);
    expect(notes.unread).toBe(0);
    expect(notes.inbox[0].openedAt).toBeGreaterThan(0);
    expect(notes.unsendNote(incoming.id)).toBe(false);
  });

  it('moves a letter to the trash and restores it', async () => {
    const notes = useNotesStore();
    const app = useAppStore();
    await notes.init();
    const draft = notes.createDraft();
    expect(notes.trashNote(draft.id)).toBe(true);
    expect(notes.drafts).toHaveLength(0);
    expect(app.trash).toHaveLength(1);
    expect(app.trash[0].kind).toBe('note');

    await app.restoreItem(app.trash[0]);
    await notes.init(true);
    expect(notes.drafts).toHaveLength(1);
  });

  it('does not send a letter with no recipient', async () => {
    const notes = useNotesStore();
    await notes.init();
    const draft = notes.createDraft();
    draft.recipientId = '';
    expect(notes.sendNote(draft.id)).toBeNull();
    expect(notes.drafts).toHaveLength(1);
  });
});

import type { AppData, Note } from './types';

export interface IntegrityReport {
  /** Pages whose book no longer exists. */
  orphanPages: number;
  /** Elements whose page no longer exists. */
  orphanElements: number;
  /** Photos whose book no longer exists. */
  orphanMedia: number;
  /** Image elements whose album photo no longer exists. */
  danglingMediaRefs: number;
  /** Attached room items whose host no longer exists. */
  danglingAttachments: number;
  total: number;
}

/** Find records left dangling by an interrupted cascade or a partial import. */
export function auditIntegrity(data: AppData): IntegrityReport {
  const nodeIds = new Set(data.content.nodes.map((n) => n.id));
  const pageIds = new Set(data.content.pages.map((p) => p.id));
  const mediaIds = new Set(data.content.media.map((m) => m.id));
  const roomItemIds = new Set(data.roomItems.map((item) => item.id));
  const orphanPages = data.content.pages.filter((p) => !nodeIds.has(p.bookId)).length;
  const orphanElements = data.content.elements.filter((e) => !pageIds.has(e.pageId)).length;
  const orphanMedia = data.content.media.filter((m) => !nodeIds.has(m.bookId)).length;
  const danglingMediaRefs = data.content.elements.filter(
    (element) => element.kind === 'image' && !!element.mediaId && !mediaIds.has(element.mediaId),
  ).length;
  const danglingAttachments = data.roomItems.filter(
    (item) => !!item.attachTo && !roomItemIds.has(item.attachTo),
  ).length;
  return {
    orphanPages,
    orphanElements,
    orphanMedia,
    danglingMediaRefs,
    danglingAttachments,
    total: orphanPages + orphanElements + orphanMedia + danglingMediaRefs + danglingAttachments,
  };
}

export interface NoteIntegrityReport {
  /** Notes whose author or recipient no longer exists. */
  orphanNotes: number;
}

export function auditNotes(notes: Note[], userIds: Iterable<string>): NoteIntegrityReport {
  const known = new Set(userIds);
  const orphanNotes = notes.filter(
    (note) => !note.deletedAt && (!known.has(note.authorId) || !known.has(note.recipientId)),
  ).length;
  return { orphanNotes };
}

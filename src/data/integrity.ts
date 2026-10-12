import type { AppData } from './types';

export interface IntegrityReport {
  /** Pages whose book no longer exists. */
  orphanPages: number;
  /** Elements whose page no longer exists. */
  orphanElements: number;
  /** Photos whose book no longer exists. */
  orphanMedia: number;
  total: number;
}

/** Find records left dangling by an interrupted cascade or a partial import. */
export function auditIntegrity(data: AppData): IntegrityReport {
  const nodeIds = new Set(data.content.nodes.map((n) => n.id));
  const pageIds = new Set(data.content.pages.map((p) => p.id));
  const orphanPages = data.content.pages.filter((p) => !nodeIds.has(p.bookId)).length;
  const orphanElements = data.content.elements.filter((e) => !pageIds.has(e.pageId)).length;
  const orphanMedia = data.content.media.filter((m) => !nodeIds.has(m.bookId)).length;
  return {
    orphanPages,
    orphanElements,
    orphanMedia,
    total: orphanPages + orphanElements + orphanMedia,
  };
}

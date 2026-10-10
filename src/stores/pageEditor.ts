import { defineStore } from 'pinia';
import type { ImageEffects, PageElement, PageElementInput, PageGroup, TapeStyle } from '@/data/types';
import { useAppStore } from './app';
import type { Dock } from './editor';
import { clone } from '@/utils/clone';
import { NOTE_COLORS, stickerById, tapeById } from '@/scrapbook/decor';
import { frameAspect, frameById } from '@/scrapbook/frames';
import { defaultGroupId, ensureGroups } from '@/scrapbook/groups';

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

interface PageDraft {
  background?: string;
  paperColors?: Record<string, string>;
  elements: PageElement[];
  groups: PageGroup[];
}

/** Base-transform + per-kind fields that the page editor may patch. */
export interface PageElementPatch {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  z?: number;
  opacity?: number;
  color?: string;
  colors?: Record<string, string>;
  frameColors?: Record<string, string>;
  text?: string;
  caption?: string;
  mediaId?: string;
  icon?: string;
  style?: TapeStyle;
  ink?: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  paper?: string;
  uppercase?: boolean;
  shadow?: boolean;
  name?: string;
  scale?: number;
}

const UI_KEY = 'journeybook:page-editor-ui:v1';

function pbId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return raw.slice(0, 15).padEnd(15, '0');
}

function loadUi(): { dock: Dock; collapsed: boolean } {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { dock?: Dock; collapsed?: boolean };
      return { dock: parsed.dock ?? 'right', collapsed: !!parsed.collapsed };
    }
  } catch {
    /* ignore */
  }
  return { dock: 'right', collapsed: false };
}

export const usePageEditorStore = defineStore('pageEditor', {
  state: () => {
    const ui = loadUi();
    return {
      isEditing: false,
      bookId: '',
      pageId: '',
      index: 0,
      draft: null as PageDraft | null,
      selectedId: null as string | null,
      editingImageId: null as string | null,
      editingNoteId: null as string | null,
      cropMode: false,
      dirty: false,
      showExit: false,
      dock: ui.dock as Dock,
      collapsed: ui.collapsed,
      history: [] as PageDraft[],
      future: [] as PageDraft[],
    };
  },
  getters: {
    elements: (s): PageElement[] => (s.draft ? [...s.draft.elements].sort((a, b) => a.z - b.z) : []),
    selected: (s): PageElement | null =>
      s.selectedId && s.draft ? (s.draft.elements.find((e) => e.id === s.selectedId) ?? null) : null,
    editingImage: (s): PageElement | null =>
      s.editingImageId && s.draft ? (s.draft.elements.find((e) => e.id === s.editingImageId) ?? null) : null,
    editingNote: (s): PageElement | null =>
      s.editingNoteId && s.draft ? (s.draft.elements.find((e) => e.id === s.editingNoteId) ?? null) : null,
    groups: (s): PageGroup[] => s.draft?.groups ?? [],
    background: (s): string | undefined => s.draft?.background,
    paperColors: (s): Record<string, string> => s.draft?.paperColors ?? {},
    canUndo: (s): boolean => s.history.length > 0,
    canRedo: (s): boolean => s.future.length > 0,
  },
  actions: {
    persistUi() {
      try {
        localStorage.setItem(UI_KEY, JSON.stringify({ dock: this.dock, collapsed: this.collapsed }));
      } catch {
        /* ignore */
      }
    },
    setDock(dock: Dock) {
      this.dock = dock;
      this.persistUi();
    },
    toggleCollapsed() {
      this.collapsed = !this.collapsed;
      this.persistUi();
    },
    select(id: string | null) {
      this.selectedId = id;
      if (this.editingImageId && id !== this.editingImageId) this.editingImageId = null;
      if (this.editingNoteId && id !== this.editingNoteId) this.editingNoteId = null;
      if (!this.selected) this.cropMode = false;
    },

    start(bookId: string, pageId: string) {
      const app = useAppStore();
      const page = app.data.content.pages.find((p) => p.id === pageId);
      if (!page) return;
      this.bookId = bookId;
      this.pageId = pageId;
      this.index = page.index;
      const elements = clone(app.elementsOf(pageId)).map((el) => ({
        ...el,
        aspectLocked: el.aspectLocked ?? true,
        groupId: el.groupId ?? defaultGroupId(el.kind),
      }));
      this.draft = { background: page.background, paperColors: page.paperColors, elements, groups: ensureGroups(page.groups) };
      this.selectedId = null;
      this.editingImageId = null;
      this.editingNoteId = null;
      this.cropMode = false;
      this.dirty = false;
      this.isEditing = true;
      this.showExit = false;
      this.history = [];
      this.future = [];
    },

    requestExit() {
      // Nothing changed -> leave without the save dialog.
      if (!this.dirty) {
        this.finish();
        return;
      }
      this.showExit = true;
    },
    cancelExit() {
      this.showExit = false;
    },
    save() {
      const app = useAppStore();
      if (this.draft) {
        const draftIds = new Set(this.draft.elements.map((e) => e.id));
        for (const existing of app.elementsOf(this.pageId)) {
          if (!draftIds.has(existing.id)) app.removeElement(existing.id);
        }
        for (const el of this.draft.elements) app.putElement(el);
        app.updatePage(this.pageId, { background: this.draft.background, paperColors: this.draft.paperColors, groups: this.draft.groups });
      }
      this.finish();
    },
    discard() {
      this.finish();
    },
    finish() {
      this.draft = null;
      this.isEditing = false;
      this.selectedId = null;
      this.editingImageId = null;
      this.editingNoteId = null;
      this.cropMode = false;
      this.showExit = false;
      this.dirty = false;
      this.history = [];
      this.future = [];
    },

    // ---- history (undo/redo) ----
    /** Capture the current draft so the next mutation can be undone. */
    snapshot() {
      if (!this.draft) return;
      this.history.push(clone(this.draft));
      if (this.history.length > 100) this.history.shift();
      this.future = [];
    },
    undo() {
      if (!this.draft || !this.history.length) return;
      this.future.push(clone(this.draft));
      this.draft = this.history.pop() as PageDraft;
      this.dirty = true;
      if (this.selectedId && !this.draft.elements.some((e) => e.id === this.selectedId)) this.selectedId = null;
      if (this.editingImageId && !this.draft.elements.some((e) => e.id === this.editingImageId)) this.editingImageId = null;
    },
    redo() {
      if (!this.draft || !this.future.length) return;
      this.history.push(clone(this.draft));
      this.draft = this.future.pop() as PageDraft;
      this.dirty = true;
    },

    // ---- draft mutations ----
    addElement(input: PageElementInput): PageElement | null {
      if (!this.draft) return null;
      this.snapshot();
      const z = this.draft.elements.reduce((m, e) => Math.max(m, e.z), 0) + 1;
      const el = {
        id: pbId(),
        pageId: this.pageId,
        z,
        opacity: 1,
        locked: false,
        aspectLocked: true,
        groupId: defaultGroupId(input.kind),
        ...input,
      } as PageElement;
      this.draft.elements.push(el);
      this.selectedId = el.id;
      this.dirty = true;
      return el;
    },
    addImage(mediaId: string) {
      const aspect = frameAspect(frameById('polaroid')) ?? 1;
      const w = 0.44;
      return this.addElement({
        kind: 'image',
        mediaId,
        caption: '',
        frame: 'polaroid',
        zoom: 1,
        focusX: 0.5,
        focusY: 0.5,
        preset: 'custom',
        effects: {},
        x: 0.5,
        y: 0.47,
        w,
        h: w / aspect,
        rotation: -2,
      });
    },
    addNote() {
      return this.addElement({
        kind: 'note',
        text: 'Write something sweet…',
        font: 'pen',
        size: 18,
        ink: '#4a3b2e',
        paper: 'sticky',
        color: NOTE_COLORS[0],
        align: 'center',
        valign: 'middle',
        lineHeight: 1.3,
        x: 0.5,
        y: 0.5,
        w: 0.5,
        h: 0.22,
        rotation: 2,
      });
    },
    addSticker(icon: string) {
      const def = stickerById(icon);
      return this.addElement({ kind: 'sticker', icon, x: 0.5, y: 0.5, w: 0.18, h: 0.18 / def.aspect, rotation: -6 });
    },
    addTape(style: TapeStyle) {
      const def = tapeById(style);
      return this.addElement({
        kind: 'tape',
        style,
        color: def.defaultColor,
        x: 0.5,
        y: 0.5,
        w: 0.42,
        h: 0.42 / def.aspect,
        rotation: -4,
      });
    },
    removeElement(id: string) {
      if (!this.draft) return;
      const el = this.draft.elements.find((e) => e.id === id);
      if (!el || el.locked) return;
      this.snapshot();
      this.draft.elements = this.draft.elements.filter((e) => e.id !== id);
      if (this.selectedId === id) this.selectedId = null;
      if (this.editingImageId === id) this.editingImageId = null;
      this.dirty = true;
    },
    duplicateElement(id: string) {
      if (!this.draft) return;
      const el = this.draft.elements.find((e) => e.id === id);
      if (!el) return;
      this.snapshot();
      const copy = clone(el);
      copy.id = pbId();
      copy.locked = false;
      copy.z = this.draft.elements.reduce((m, e) => Math.max(m, e.z), 0) + 1;
      copy.x = Math.min(0.97, copy.x + 0.04);
      copy.y = Math.min(0.97, copy.y + 0.04);
      this.draft.elements.push(copy);
      this.selectedId = copy.id;
      this.dirty = true;
    },
    /** Continuous (no snapshot); callers snapshot once per gesture. */
    updateElement(id: string, patch: PageElementPatch) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.locked) return;
      Object.assign(el, patch);
      this.dirty = true;
    },
    setZ(id: string, z: number) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el) return;
      this.snapshot();
      el.z = Math.max(0, Math.round(z));
      this.dirty = true;
    },
    setLocked(id: string, value: boolean) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el) return;
      this.snapshot();
      el.locked = value;
      this.dirty = true;
    },
    setAspectLocked(id: string, value: boolean) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el) return;
      this.snapshot();
      el.aspectLocked = value;
      this.dirty = true;
    },
    changeMedia(id: string, mediaId: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      this.snapshot();
      el.mediaId = mediaId;
      this.dirty = true;
    },
    setFrame(id: string, frameId: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      this.snapshot();
      el.frame = frameId;
      const aspect = frameAspect(frameById(frameId));
      if (aspect) el.h = el.w / aspect;
      this.dirty = true;
    },
    setFrameColor(id: string, color: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.frameColor = color;
      this.dirty = true;
    },
    setFrameSlotColor(id: string, slotId: string, color: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.frameColors = { ...(el.frameColors ?? {}), [slotId]: color };
      this.dirty = true;
    },
    applyFrameColors(id: string, colors: Record<string, string>) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.frameColors = { ...(el.frameColors ?? {}), ...colors };
      this.dirty = true;
    },
    setElementSlotColor(id: string, slotId: string, color: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || (el.kind !== 'sticker' && el.kind !== 'tape')) return;
      el.colors = { ...(el.colors ?? {}), [slotId]: color };
      this.dirty = true;
    },
    applyElementColors(id: string, colors: Record<string, string>) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || (el.kind !== 'sticker' && el.kind !== 'tape')) return;
      el.colors = { ...(el.colors ?? {}), ...colors };
      this.dirty = true;
    },
    setZoom(id: string, zoom: number) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.zoom = clamp(zoom, 1, 4);
      this.dirty = true;
    },
    setFocus(id: string, x: number, y: number) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.focusX = clamp(x, 0, 1);
      el.focusY = clamp(y, 0, 1);
      this.dirty = true;
    },
    resetCrop(id: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      this.snapshot();
      el.zoom = 1;
      el.focusX = 0.5;
      el.focusY = 0.5;
      this.dirty = true;
    },
    applyPreset(id: string, presetId: string, effects: ImageEffects) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      this.snapshot();
      el.preset = presetId;
      el.effects = clone(effects);
      this.dirty = true;
    },
    setEffect(id: string, key: keyof ImageEffects, value: number) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      el.effects = { ...(el.effects ?? {}), [key]: value };
      el.preset = 'custom';
      this.dirty = true;
    },
    setCropMode(value: boolean) {
      this.cropMode = value;
    },
    openImageEditor(id: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'image') return;
      this.selectedId = id;
      this.editingImageId = id;
      this.editingNoteId = null;
      this.cropMode = false;
    },
    closeImageEditor() {
      this.editingImageId = null;
      this.cropMode = false;
    },
    openNoteEditor(id: string) {
      const el = this.draft?.elements.find((e) => e.id === id);
      if (!el || el.kind !== 'note') return;
      this.selectedId = id;
      this.editingNoteId = id;
      this.editingImageId = null;
    },
    closeNoteEditor() {
      this.editingNoteId = null;
    },
    setPaper(id: string) {
      if (!this.draft) return;
      this.snapshot();
      this.draft.background = id;
      this.dirty = true;
    },
    setPaperColor(slotId: string, color: string) {
      if (!this.draft) return;
      this.draft.paperColors = { ...(this.draft.paperColors ?? {}), [slotId]: color };
      this.dirty = true;
    },
    applyPaperColors(colors: Record<string, string>) {
      if (!this.draft) return;
      this.snapshot();
      this.draft.paperColors = { ...(this.draft.paperColors ?? {}), ...colors };
      this.dirty = true;
    },

    // ---- layer groups + ordering ----
    /** Flatten elements front-to-back following group order. */
    flatten(): PageElement[] {
      if (!this.draft) return [];
      const out: PageElement[] = [];
      for (const g of this.draft.groups) {
        const items = this.draft.elements.filter((e) => e.groupId === g.id).sort((a, b) => b.z - a.z);
        out.push(...items);
      }
      // any element without a known group goes last
      const known = new Set(this.draft.groups.map((g) => g.id));
      out.push(...this.draft.elements.filter((e) => !known.has(e.groupId ?? '')).sort((a, b) => b.z - a.z));
      return out;
    },
    reassignZ() {
      if (!this.draft) return;
      const order = this.flatten();
      const n = order.length;
      order.forEach((el, i) => {
        el.z = n - i;
      });
    },
    placeElement(elementId: string, targetGroupId: string, beforeId: string | null) {
      if (!this.draft) return;
      const el = this.draft.elements.find((e) => e.id === elementId);
      if (!el || el.locked) return;
      this.snapshot();
      const order = this.flatten().filter((e) => e.id !== elementId);
      el.groupId = targetGroupId;
      let idx: number;
      if (beforeId) {
        idx = order.findIndex((e) => e.id === beforeId);
        if (idx < 0) idx = order.length;
      } else {
        // end of the target group
        let last = -1;
        order.forEach((e, i) => {
          if (e.groupId === targetGroupId) last = i;
        });
        if (last >= 0) idx = last + 1;
        else {
          // empty group: place after all elements of preceding groups
          const gi = this.draft.groups.findIndex((g) => g.id === targetGroupId);
          const before = new Set(this.draft.groups.slice(0, gi < 0 ? 0 : gi).map((g) => g.id));
          let lastBefore = -1;
          order.forEach((e, i) => {
            if (before.has(e.groupId ?? '')) lastBefore = i;
          });
          idx = lastBefore + 1;
        }
      }
      order.splice(idx, 0, el);
      const n = order.length;
      order.forEach((e, i) => {
        e.z = n - i;
      });
      this.dirty = true;
    },
    addGroup(name: string) {
      if (!this.draft) return;
      this.snapshot();
      this.draft.groups.unshift({ id: `g-${pbId()}`, name: name.trim() || 'Group' });
      this.dirty = true;
    },
    renameGroup(id: string, name: string) {
      const g = this.draft?.groups.find((gr) => gr.id === id);
      if (!g) return;
      g.name = name;
      this.dirty = true;
    },
    toggleGroup(id: string) {
      const g = this.draft?.groups.find((gr) => gr.id === id);
      if (g) {
        g.collapsed = !g.collapsed;
        this.dirty = true;
      }
    },
    moveGroup(id: string, dir: -1 | 1) {
      if (!this.draft) return;
      const groups = this.draft.groups;
      const i = groups.findIndex((g) => g.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= groups.length) return;
      this.snapshot();
      [groups[i], groups[j]] = [groups[j], groups[i]];
      this.reassignZ();
      this.dirty = true;
    },
    deleteGroup(id: string) {
      if (!this.draft) return;
      if (this.draft.groups.length <= 1) return;
      this.snapshot();
      const fallback = this.draft.groups.find((g) => g.id !== id)?.id ?? 'g-photos';
      for (const el of this.draft.elements) if (el.groupId === id) el.groupId = fallback;
      this.draft.groups = this.draft.groups.filter((g) => g.id !== id);
      this.reassignZ();
      this.dirty = true;
    },
  },
});

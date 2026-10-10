import { defineStore } from 'pinia';
import type { DayNightMode, Placement, Room, RoomItem, StoredLayout } from '@/data/types';
import { useAppStore, type Viewport } from './app';
import { getCatalogItem } from '@/catalog/catalog';
import { deriveMobile } from '@/room/geometry';
import { resolveTimeOfDay, type TimeOfDay } from '@/room/daynight';
import { clone } from '@/utils/clone';

export type Dock = 'left' | 'right';

interface Draft {
  room: Room;
  items: RoomItem[];
}

const UI_KEY = 'journeybook:editor-ui:v1';

function pbId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return raw.slice(0, 15).padEnd(15, '0');
}
function loadUi(): { dock: Dock; collapsed: boolean } {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { dock?: string; collapsed?: boolean };
      // Only left/right are supported; coerce anything else (incl. old top/bottom).
      return { dock: parsed.dock === 'left' ? 'left' : 'right', collapsed: !!parsed.collapsed };
    }
  } catch {
    /* ignore */
  }
  return { dock: 'right', collapsed: false };
}

export const useEditorStore = defineStore('editor', {
  state: () => {
    const ui = loadUi();
    return {
      isEditing: false,
      selectedId: null as string | null,
      viewport: 'desktop' as Viewport,
      dock: ui.dock as Dock,
      collapsed: ui.collapsed,
      dirty: false,
      showExit: false,
      draft: null as Draft | null,
      layouts: [] as StoredLayout[],
      history: [] as Draft[],
      future: [] as Draft[],
      /** Last click used to cycle through overlapping items. */
      lastPick: null as { x: number; y: number; index: number } | null,
      /** The item currently being dragged (renders a translucent preview on top). */
      draggingId: null as string | null,
      /** While dragging, the host the item is currently over (for the attach preview). */
      attachPreview: null as { itemId: string; hostId: string; ax: number; ay: number } | null,
      /** While dragging, the item that will be removed from its host (detach preview). */
      removePreviewId: null as string | null,
    };
  },
  getters: {
    items: (s): RoomItem[] => (s.draft ? s.draft.items : []),
    draftRoom: (s): Room | null => (s.draft ? s.draft.room : null),
    selected: (s): RoomItem | null =>
      s.selectedId && s.draft ? (s.draft.items.find((i) => i.id === s.selectedId) ?? null) : null,
    canUndo: (s): boolean => s.history.length > 0,
    canRedo: (s): boolean => s.future.length > 0,
    timeOfDay(s): TimeOfDay {
      const room = s.draft?.room ?? useAppStore().room;
      return resolveTimeOfDay(room.dayNightMode, room.referenceTz);
    },
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
    setViewport(viewport: Viewport) {
      this.viewport = viewport;
    },
    setDragging(id: string | null) {
      this.draggingId = id;
    },
    setAttachPreview(preview: { itemId: string; hostId: string; ax: number; ay: number } | null) {
      this.attachPreview = preview;
    },
    setRemovePreview(id: string | null) {
      this.removePreviewId = id;
    },
    select(id: string | null) {
      this.selectedId = id;
    },
    /**
     * Select among overlapping items at a point. A repeated click at the same
     * spot steps down through the stack (top-to-front order in `ids`).
     */
    pickAt(ids: string[], x: number, y: number) {
      if (!ids.length) return;
      const near = this.lastPick != null && Math.hypot(x - this.lastPick.x, y - this.lastPick.y) < 6;
      const index = near && this.lastPick ? (this.lastPick.index + 1) % ids.length : 0;
      this.lastPick = { x, y, index };
      this.selectedId = ids[index];
    },

    async start() {
      const app = useAppStore();
      this.draft = { room: clone(app.room), items: clone(app.roomItems) };
      this.selectedId = null;
      this.dirty = false;
      this.isEditing = true;
      this.showExit = false;
      this.history = [];
      this.future = [];
      this.attachPreview = null;
      this.removePreviewId = null;
      this.layouts = await app.listLayouts().catch(() => []);
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
      this.draft = this.history.pop() as Draft;
      this.dirty = true;
      if (this.selectedId && !this.draft.items.some((i) => i.id === this.selectedId)) this.selectedId = null;
    },
    redo() {
      if (!this.draft || !this.future.length) return;
      this.history.push(clone(this.draft));
      this.draft = this.future.pop() as Draft;
      this.dirty = true;
    },
    async reloadLayouts() {
      const app = useAppStore();
      this.layouts = await app.listLayouts().catch(() => []);
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
    async save() {
      const app = useAppStore();
      if (this.draft) app.applyRoomLayout(this.draft.room, this.draft.items);
      this.finish();
    },
    async discard() {
      this.finish();
    },
    async saveAs(name: string) {
      const app = useAppStore();
      if (this.draft) {
        await app.saveNamedLayout(name.trim() || 'Untitled', this.draft.room, this.draft.items);
        app.applyRoomLayout(this.draft.room, this.draft.items);
      }
      this.finish();
    },
    finish() {
      this.draft = null;
      this.isEditing = false;
      this.selectedId = null;
      this.showExit = false;
      this.dirty = false;
      this.history = [];
      this.future = [];
      this.attachPreview = null;
      this.removePreviewId = null;
      this.draggingId = null;
    },
    async loadLayout(id: string) {
      const layout = this.layouts.find((l) => l.id === id);
      if (!layout) return;
      this.draft = { room: clone(layout.room), items: clone(layout.items) };
      this.selectedId = null;
      this.dirty = true;
    },
    async deleteLayout(id: string) {
      const app = useAppStore();
      await app.deleteLayout(id);
      await this.reloadLayouts();
    },

    // ---- draft mutations ----
    itemById(id: string): RoomItem | undefined {
      return this.draft?.items.find((i) => i.id === id);
    },
    addItem(catalogId: string, at?: { x?: number; y?: number; hostId?: string; ax?: number; ay?: number }): RoomItem | null {
      if (!this.draft) return null;
      const cat = getCatalogItem(catalogId);
      if (!cat) return null;
      this.snapshot();
      const z = this.draft.items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
      const item: RoomItem = {
        id: pbId(),
        catalogId,
        layer: cat.layer,
        z,
        attachTo: at?.hostId,
        color: {},
        desktop: {
          x: at?.x ?? 0.5,
          y: at?.y ?? 0.5,
          scale: cat.defaultScale,
          rotation: cat.defaultRotation,
          flip: false,
          ax: at?.ax,
          ay: at?.ay,
        },
        locked: false,
      };
      this.draft.items.push(item);
      this.selectedId = item.id;
      this.dirty = true;
      return item;
    },
    removeItem(id: string) {
      if (!this.draft) return;
      const item = this.itemById(id);
      if (!item || item.locked) return;
      this.snapshot();
      this.draft.items = this.draft.items.filter((i) => i.id !== id);
      if (this.selectedId === id) this.selectedId = null;
      this.dirty = true;
    },
    /** Remove every placed item from the room (undoable). */
    clearItems() {
      if (!this.draft || this.draft.items.length === 0) return;
      this.snapshot();
      this.draft.items = [];
      this.selectedId = null;
      this.attachPreview = null;
      this.removePreviewId = null;
      this.dirty = true;
    },
    duplicateItem(id: string) {
      if (!this.draft) return;
      const item = this.itemById(id);
      if (!item) return;
      this.snapshot();
      const copy = clone(item);
      copy.id = pbId();
      copy.z = this.draft.items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
      copy.desktop = { ...copy.desktop, x: Math.min(0.98, copy.desktop.x + 0.05) };
      this.draft.items.push(copy);
      this.selectedId = copy.id;
      this.dirty = true;
    },
    updatePlacement(id: string, viewport: Viewport, patch: Partial<Placement>) {
      const item = this.itemById(id);
      if (!item || item.locked) return;
      if (viewport === 'desktop') {
        item.desktop = { ...item.desktop, ...patch };
      } else {
        const current = item.mobile ?? deriveMobile(item.desktop);
        item.mobile = { ...current, ...patch };
      }
      this.dirty = true;
    },
    /** Attach an item to a host, storing host-relative coordinates. */
    setAttach(id: string, viewport: Viewport, hostId: string, ax: number, ay: number) {
      const item = this.itemById(id);
      if (!item || item.locked) return;
      item.attachTo = hostId;
      this.updatePlacement(id, viewport, { ax, ay });
    },
    /** Detach an item, restoring absolute band coordinates. */
    detach(id: string, viewport: Viewport, x: number, y: number) {
      const item = this.itemById(id);
      if (!item || item.locked) return;
      item.attachTo = undefined;
      this.updatePlacement(id, viewport, { x, y, ax: undefined, ay: undefined });
    },
    setColor(id: string, slotId: string, color: string) {
      const item = this.itemById(id);
      if (!item) return;
      item.color = { ...item.color, [slotId]: color };
      this.dirty = true;
    },
    setColors(id: string, colors: Record<string, string>) {
      const item = this.itemById(id);
      if (!item) return;
      item.color = { ...item.color, ...colors };
      this.dirty = true;
    },
    setHideMobile(id: string, value: boolean) {
      const item = this.itemById(id);
      if (!item) return;
      item.hideMobile = value;
      this.dirty = true;
    },
    setZ(id: string, z: number) {
      const item = this.itemById(id);
      if (!item) return;
      item.z = z;
      this.dirty = true;
    },
    setLocked(id: string, value: boolean) {
      const item = this.itemById(id);
      if (!item) return;
      item.locked = value;
      this.dirty = true;
    },
    /** Keyboard nudge for the selected item (fractions of its band/host). */
    nudge(id: string, dx: number, dy: number) {
      const item = this.itemById(id);
      if (!item || item.locked) return;
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      const isMobile = this.viewport === 'mobile';
      if (item.attachTo) {
        const base = isMobile ? (item.mobile ?? deriveMobile(item.desktop)) : item.desktop;
        const patch = { ax: clamp((base.ax ?? 0.5) + dx), ay: clamp((base.ay ?? 0) + dy) };
        this.updatePlacement(id, this.viewport, patch);
      } else if (isMobile) {
        const base = item.mobile ?? deriveMobile(item.desktop);
        this.updatePlacement(id, this.viewport, { x: clamp(base.x + dx), y: clamp(base.y + dy) });
      } else {
        this.updatePlacement(id, this.viewport, {
          x: clamp(item.desktop.x + dx),
          y: clamp(item.desktop.y + dy),
        });
      }
    },
    /**
     * Reorder `draggedId` to just in front of `beforeId` among its siblings
     * (same host; `parentId` = host id, or '' for top-level). `beforeId` null
     * drops it at the back of the group, then sequential `z` is reassigned.
     */
    reorderSibling(draggedId: string, beforeId: string | null, parentId: string) {
      if (!this.draft) return;
      const dragged = this.itemById(draggedId);
      if (!dragged || dragged.locked) return;
      if (beforeId === draggedId) return;
      const siblings = this.draft.items
        .filter((i) => (i.attachTo ?? '') === parentId && i.id !== draggedId)
        .sort((a, b) => b.z - a.z);
      let idx = beforeId ? siblings.findIndex((i) => i.id === beforeId) : siblings.length;
      if (idx < 0) idx = siblings.length;
      this.snapshot();
      siblings.splice(idx, 0, dragged);
      const n = siblings.length;
      siblings.forEach((it, i) => {
        it.z = n - i;
      });
      this.dirty = true;
    },
    setWall(id: string) {
      if (this.draft) {
        this.snapshot();
        this.draft.room.wallId = id;
        this.dirty = true;
      }
    },
    setFloor(id: string) {
      if (this.draft) {
        this.snapshot();
        this.draft.room.floorId = id;
        this.dirty = true;
      }
    },
    setDayNightMode(mode: DayNightMode) {
      if (this.draft) {
        this.snapshot();
        this.draft.room.dayNightMode = mode;
        this.dirty = true;
      }
    },
    setReferenceTz(tz: string) {
      if (this.draft) {
        this.snapshot();
        this.draft.room.referenceTz = tz;
        this.dirty = true;
      }
    },
  },
});

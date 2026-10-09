import { defineStore } from 'pinia';
import type { DayNightMode, Placement, Room, RoomItem, StoredLayout } from '@/data/types';
import { useAppStore, type Viewport } from './app';
import { getCatalogItem } from '@/catalog/catalog';
import { deriveMobile } from '@/room/geometry';
import { resolveTimeOfDay, type TimeOfDay } from '@/room/daynight';
import { clone } from '@/utils/clone';

export type Dock = 'top' | 'bottom' | 'left' | 'right';

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
      const parsed = JSON.parse(raw) as { dock?: Dock; collapsed?: boolean };
      return { dock: parsed.dock ?? 'right', collapsed: !!parsed.collapsed };
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
    };
  },
  getters: {
    items: (s): RoomItem[] => (s.draft ? s.draft.items : []),
    draftRoom: (s): Room | null => (s.draft ? s.draft.room : null),
    selected: (s): RoomItem | null =>
      s.selectedId && s.draft ? (s.draft.items.find((i) => i.id === s.selectedId) ?? null) : null,
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
    select(id: string | null) {
      this.selectedId = id;
    },

    async start() {
      const app = useAppStore();
      this.draft = { room: clone(app.room), items: clone(app.roomItems) };
      this.selectedId = null;
      this.dirty = false;
      this.isEditing = true;
      this.showExit = false;
      this.layouts = await app.listLayouts().catch(() => []);
    },
    async reloadLayouts() {
      const app = useAppStore();
      this.layouts = await app.listLayouts().catch(() => []);
    },
    requestExit() {
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
    addItem(catalogId: string, at?: { x: number; y: number }): RoomItem | null {
      if (!this.draft) return null;
      const cat = getCatalogItem(catalogId);
      if (!cat) return null;
      const z = this.draft.items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
      const item: RoomItem = {
        id: pbId(),
        catalogId,
        layer: cat.layer,
        z,
        color: {},
        desktop: {
          x: at?.x ?? 0.5,
          y: at?.y ?? 0.5,
          scale: cat.defaultScale,
          rotation: cat.defaultRotation,
          flip: false,
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
      this.draft.items = this.draft.items.filter((i) => i.id !== id);
      if (this.selectedId === id) this.selectedId = null;
      this.dirty = true;
    },
    duplicateItem(id: string) {
      if (!this.draft) return;
      const item = this.itemById(id);
      if (!item) return;
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
    setWall(id: string) {
      if (this.draft) {
        this.draft.room.wallId = id;
        this.dirty = true;
      }
    },
    setFloor(id: string) {
      if (this.draft) {
        this.draft.room.floorId = id;
        this.dirty = true;
      }
    },
    setDayNightMode(mode: DayNightMode) {
      if (this.draft) {
        this.draft.room.dayNightMode = mode;
        this.dirty = true;
      }
    },
    setReferenceTz(tz: string) {
      if (this.draft) {
        this.draft.room.referenceTz = tz;
        this.dirty = true;
      }
    },
  },
});

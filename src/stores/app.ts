import { defineStore } from 'pinia';
import type {
  AppData,
  CoverColor,
  PageElement,
  PageElementInput,
  Placement,
  RoomItem,
  ScrapNode,
  ScrapPage,
} from '@/data/types';
import { clearData, loadData } from '@/data/storage';
import { createSeedData } from '@/data/seed';
import { getCatalogItem } from '@/catalog/catalog';
import { deriveMobile } from '@/room/geometry';
import { resolveTimeOfDay, type TimeOfDay } from '@/room/daynight';
import { backend } from '@/data/backend';

const COVERS: CoverColor[] = ['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft'];

/** PocketBase-compatible id: 15 chars of [a-z0-9]. */
function newId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return raw.slice(0, 15).padEnd(15, '0');
}

let refreshTimer: number | undefined;

export type Viewport = 'desktop' | 'mobile';

export const useAppStore = defineStore('app', {
  state: () => ({ data: (loadData() ?? createSeedData()) as AppData, synced: false }),
  getters: {
    room: (s) => s.data.room,
    roomItems: (s) => s.data.roomItems,
    timeOfDay(s): TimeOfDay {
      return resolveTimeOfDay(s.data.room.dayNightMode, s.data.room.referenceTz);
    },
    itemById: (s) => {
      return (id: string): RoomItem | undefined => s.data.roomItems.find((i) => i.id === id);
    },
  },
  actions: {
    save() {
      backend.persistLocal(this.data);
    },
    reset() {
      clearData();
      this.data = createSeedData();
      this.save();
    },

    // ---- backend lifecycle ----
    async initBackend() {
      if (backend.kind === 'local') {
        this.synced = true;
        return;
      }
      try {
        const data = await backend.fetchAll();
        if (data) this.data = data;
        backend.subscribe(() => this.scheduleRefresh());
        this.synced = true;
      } catch (e) {
        console.error('initBackend', e);
      }
    },
    scheduleRefresh() {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void this.refreshFromBackend(), 250);
    },
    async refreshFromBackend() {
      if (backend.kind === 'local') return;
      try {
        const data = await backend.fetchAll();
        if (data) this.data = data;
      } catch (e) {
        console.error('refreshFromBackend', e);
      }
    },

    // ---- book content ----
    node(id: string): ScrapNode | undefined {
      return this.data.content.nodes.find((n) => n.id === id);
    },
    childrenOf(parentId: string | null): ScrapNode[] {
      return this.data.content.nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);
    },
    breadcrumb(folderId: string | null): ScrapNode[] {
      const chain: ScrapNode[] = [];
      let cur = folderId;
      while (cur) {
        const node = this.node(cur);
        if (!node) break;
        chain.unshift(node);
        cur = node.parentId;
      }
      return chain;
    },
    createNode(type: 'folder' | 'scrapbook', parentId: string | null, title: string): ScrapNode {
      const order = this.childrenOf(parentId).reduce((m, n) => Math.max(m, n.order), -1) + 1;
      const node: ScrapNode = { id: newId(), type, title, parentId, tags: [], order };
      if (type === 'scrapbook') node.cover = COVERS[Math.floor(Math.random() * COVERS.length)];
      this.data.content.nodes.push(node);
      this.save();
      backend.nodeCreate(node);
      return node;
    },
    renameNode(id: string, title: string) {
      const node = this.node(id);
      if (node) {
        node.title = title;
        this.save();
        backend.nodeUpdate(node);
      }
    },
    deleteNode(id: string) {
      const doomed = new Set<string>();
      const collect = (rootId: string) => {
        doomed.add(rootId);
        this.data.content.nodes.filter((n) => n.parentId === rootId).forEach((c) => collect(c.id));
      };
      collect(id);
      this.data.content.nodes = this.data.content.nodes.filter((n) => !doomed.has(n.id));
      this.data.content.pages = this.data.content.pages.filter((p) => !doomed.has(p.bookId));
      this.save();
      backend.nodeDelete(id);
    },

    // ---- pages ----
    pagesOf(bookId: string): ScrapPage[] {
      return this.data.content.pages.filter((p) => p.bookId === bookId).sort((a, b) => a.index - b.index);
    },
    elementsOf(pageId: string): PageElement[] {
      return this.data.content.elements.filter((e) => e.pageId === pageId).sort((a, b) => a.z - b.z);
    },
    addPage(bookId: string): ScrapPage {
      const page: ScrapPage = { id: newId(), bookId, index: this.pagesOf(bookId).length };
      this.data.content.pages.push(page);
      this.save();
      backend.pageCreate(page);
      return page;
    },
    addElement(pageId: string, el: PageElementInput) {
      const z = this.elementsOf(pageId).length + 1;
      const element = { id: newId(), pageId, z, opacity: 1, ...el } as PageElement;
      this.data.content.elements.push(element);
      this.save();
      backend.elementCreate(element);
    },
    updateElement(id: string, patch: Partial<PageElement>) {
      const el = this.data.content.elements.find((e) => e.id === id);
      if (el) {
        Object.assign(el, patch);
        this.save();
        backend.elementUpdate(el);
      }
    },
    removeElement(id: string) {
      this.data.content.elements = this.data.content.elements.filter((e) => e.id !== id);
      this.save();
      backend.elementDelete(id);
    },

    // ---- room ----
    setWall(id: string) {
      this.data.room.wallId = id;
      this.save();
      backend.roomUpdate(this.data.room);
    },
    setFloor(id: string) {
      this.data.room.floorId = id;
      this.save();
      backend.roomUpdate(this.data.room);
    },
    setDayNightMode(mode: AppData['room']['dayNightMode']) {
      this.data.room.dayNightMode = mode;
      this.save();
      backend.roomUpdate(this.data.room);
    },
    setReferenceTz(tz: string) {
      this.data.room.referenceTz = tz;
      this.save();
      backend.roomUpdate(this.data.room);
    },
    placementFor(item: RoomItem, viewport: Viewport): Placement | null {
      if (viewport === 'mobile') {
        if (item.hideMobile) return null;
        return item.mobile ?? deriveMobile(item.desktop);
      }
      return item.desktop;
    },
    addRoomItem(catalogId: string): RoomItem | null {
      const cat = getCatalogItem(catalogId);
      if (!cat) return null;
      const z = this.data.roomItems.reduce((m, i) => Math.max(m, i.z), 0) + 1;
      const item: RoomItem = {
        id: newId(),
        catalogId,
        layer: cat.layer,
        z,
        color: {},
        desktop: { x: 0.5, y: 0.5, scale: cat.defaultScale, rotation: cat.defaultRotation, flip: false },
      };
      this.data.roomItems.push(item);
      this.save();
      backend.roomItemCreate(item);
      return item;
    },
    removeRoomItem(id: string) {
      this.data.roomItems = this.data.roomItems.filter((i) => i.id !== id);
      this.save();
      backend.roomItemDelete(id);
    },
    setZ(id: string, z: number) {
      const item = this.itemById(id);
      if (item) {
        item.z = z;
        this.save();
        backend.roomItemUpdate(item);
      }
    },
    setColor(id: string, slotId: string, color: string) {
      const item = this.itemById(id);
      if (item) {
        item.color = { ...item.color, [slotId]: color };
        this.save();
        backend.roomItemUpdate(item);
      }
    },
    setHideMobile(id: string, value: boolean) {
      const item = this.itemById(id);
      if (item) {
        item.hideMobile = value;
        this.save();
        backend.roomItemUpdate(item);
      }
    },
    updatePlacement(id: string, viewport: Viewport, patch: Partial<Placement>) {
      const item = this.itemById(id);
      if (!item) return;
      if (viewport === 'desktop') {
        item.desktop = { ...item.desktop, ...patch };
      } else {
        const current = item.mobile ?? deriveMobile(item.desktop);
        item.mobile = { ...current, ...patch };
      }
      this.save();
      backend.roomItemUpdate(item);
    },
  },
});

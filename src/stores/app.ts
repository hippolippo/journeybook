import { defineStore } from 'pinia';
import type {
  AppData,
  CoverColor,
  ImagePreset,
  MediaAsset,
  PageElement,
  PageElementInput,
  Placement,
  Room,
  RoomItem,
  ScrapNode,
  ScrapPage,
  StoredLayout,
} from '@/data/types';
import { clearData, loadData } from '@/data/storage';
import { createSeedData } from '@/data/seed';
import { getCatalogItem } from '@/catalog/catalog';
import { deriveMobile } from '@/room/geometry';
import { resolveTimeOfDay, type TimeOfDay } from '@/room/daynight';
import { backend } from '@/data/backend';
import { deleteMedia, ensureMedia, hydrateMedia, mediaUrl, uploadMedia } from '@/data/media';
import { prepareImageFile } from '@/data/imageImport';
import { clone } from '@/utils/clone';

const COVERS: CoverColor[] = ['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft'];

/** PocketBase-compatible id: 15 chars of [a-z0-9]. */
function newId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return raw.slice(0, 15).padEnd(15, '0');
}

let refreshTimer: number | undefined;

export type Viewport = 'desktop' | 'mobile';

export const useAppStore = defineStore('app', {
  state: () => ({
    data: (loadData() ?? createSeedData()) as AppData,
    synced: false,
    /** Bumped when album URLs change so dependent renders refresh. */
    mediaVersion: 0,
    imagePresets: [] as ImagePreset[],
  }),
  getters: {
    room: (s) => s.data.room,
    roomItems: (s) => s.data.roomItems,
    timeOfDay(s): TimeOfDay {
      return resolveTimeOfDay(s.data.room.dayNightMode, s.data.room.referenceTz);
    },
    itemById: (s) => {
      return (id: string): RoomItem | undefined => s.data.roomItems.find((i) => i.id === id);
    },
    mediaFor: (s) => {
      return (bookId: string): MediaAsset[] => s.data.content.media.filter((m) => m.bookId === bookId);
    },
    assetUrl: (s) => {
      return (id: string): string => {
        void s.mediaVersion;
        return mediaUrl(s.data.content.media.find((m) => m.id === id));
      };
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
      try {
        if (backend.kind !== 'local') {
          const data = await backend.fetchAll();
          if (data) this.data = data;
          backend.subscribe(() => this.scheduleRefresh());
        }
        this.synced = true;
      } catch (e) {
        console.error('initBackend', e);
      }
      await this.resolveMedia();
      await this.loadImagePresets();
    },
    async resolveMedia() {
      await hydrateMedia(this.data.content.media);
      this.mediaVersion++;
    },
    async loadImagePresets() {
      try {
        this.imagePresets = await backend.listImagePresets();
      } catch (e) {
        console.error('loadImagePresets', e);
      }
    },
    async saveImagePreset(preset: ImagePreset) {
      await backend.saveImagePreset(preset);
      await this.loadImagePresets();
    },
    async deleteImagePreset(id: string) {
      await backend.deleteImagePreset(id);
      await this.loadImagePresets();
    },
    async ensureAsset(id: string) {
      const asset = this.data.content.media.find((m) => m.id === id);
      if (!asset || mediaUrl(asset)) return;
      await ensureMedia(asset);
      if (mediaUrl(asset)) this.mediaVersion++;
    },
    scheduleRefresh() {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void this.refreshFromBackend(), 250);
    },
    async refreshFromBackend() {
      if (backend.kind === 'local') return;
      try {
        const data = await backend.fetchAll();
        if (data) {
          this.data = data;
          await this.resolveMedia();
        }
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
    updateNode(id: string, patch: Partial<ScrapNode>) {
      const node = this.node(id);
      if (node) {
        Object.assign(node, patch);
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
    removePage(pageId: string) {
      const page = this.data.content.pages.find((p) => p.id === pageId);
      if (!page) return;
      const doomed = this.data.content.elements.filter((e) => e.pageId === pageId).map((e) => e.id);
      this.data.content.pages = this.data.content.pages.filter((p) => p.id !== pageId);
      this.data.content.elements = this.data.content.elements.filter((e) => e.pageId !== pageId);
      this.save();
      backend.pageDelete(pageId);
      for (const id of doomed) backend.elementDelete(id);
      // keep the remaining indexes contiguous
      this.pagesOf(page.bookId).forEach((p, i) => {
        if (p.index !== i) {
          p.index = i;
          backend.pageUpdate(p);
        }
      });
      this.save();
    },
    movePage(pageId: string, dir: -1 | 1) {
      const page = this.data.content.pages.find((p) => p.id === pageId);
      if (!page) return;
      const order = this.pagesOf(page.bookId);
      const i = order.findIndex((p) => p.id === pageId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      order.forEach((p, idx) => {
        if (p.index !== idx) {
          p.index = idx;
          backend.pageUpdate(p);
        }
      });
      this.save();
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
    /** Insert or replace an element while keeping its id (used by the page editor). */
    putElement(el: PageElement) {
      const idx = this.data.content.elements.findIndex((e) => e.id === el.id);
      if (idx >= 0) {
        this.data.content.elements[idx] = clone(el);
        this.save();
        backend.elementUpdate(el);
      } else {
        this.data.content.elements.push(clone(el));
        this.save();
        backend.elementCreate(el);
      }
    },
    removeElement(id: string) {
      this.data.content.elements = this.data.content.elements.filter((e) => e.id !== id);
      this.save();
      backend.elementDelete(id);
    },
    updatePage(id: string, patch: Partial<ScrapPage>) {
      const page = this.data.content.pages.find((p) => p.id === id);
      if (page) {
        Object.assign(page, patch);
        this.save();
        backend.pageUpdate(page);
      }
    },

    // ---- album / media ----
    async addMedia(bookId: string, file: File): Promise<MediaAsset> {
      const prepared = await prepareImageFile(file);
      const asset: MediaAsset = { id: newId(), bookId, name: prepared.name || 'photo', created: Date.now() };
      const fileName = await uploadMedia(asset, prepared);
      if (fileName) asset.fileName = fileName;
      this.data.content.media.push(asset);
      this.mediaVersion++;
      this.save();
      return asset;
    },
    async removeMedia(id: string) {
      const asset = this.data.content.media.find((m) => m.id === id);
      if (!asset) return;
      await deleteMedia(asset);
      this.data.content.media = this.data.content.media.filter((m) => m.id !== id);
      this.mediaVersion++;
      this.save();
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

    // ---- whole-room apply + named layouts ----
    applyRoomLayout(room: Room, items: RoomItem[]) {
      this.data.room = clone(room);
      this.data.roomItems = clone(items);
      this.save();
      backend.applyRoomLayout(this.data.room, this.data.roomItems);
    },
    listLayouts(): Promise<StoredLayout[]> {
      return backend.listLayouts();
    },
    async saveNamedLayout(name: string, room: Room, items: RoomItem[]): Promise<StoredLayout> {
      const layout: StoredLayout = {
        id: newId(),
        name,
        room: clone(room),
        items: clone(items),
      };
      await backend.saveLayout(layout);
      return layout;
    },
    async deleteLayout(id: string) {
      await backend.deleteLayout(id);
    },
  },
});

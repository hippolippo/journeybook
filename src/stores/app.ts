import { defineStore } from 'pinia';
import type {
  AppData,
  CalendarEvent,
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
  TrashItem,
  TrashKind,
  TrashRecordRef,
} from '@/data/types';
import { clearData, loadData } from '@/data/storage';
import { createEmptyData } from '@/data/seed';
import { getCatalogItem } from '@/catalog/catalog';
import { deriveMobile } from '@/room/geometry';
import { resolveTimeOfDay, type TimeOfDay } from '@/room/daynight';
import { backend, pb, pbOutbox } from '@/data/backend';
import {
  clearMediaToken,
  ensureMedia,
  hydrateMedia,
  mediaUrl,
  pruneMediaUrls,
  refreshMediaToken,
  releaseMediaUrl,
  uploadMedia,
} from '@/data/media';
import { prepareImageFile } from '@/data/imageImport';
import { clone } from '@/utils/clone';
import { newId } from '@/utils/id';
import { notify } from '@/utils/notify';
import { auditIntegrity } from '@/data/integrity';
import { clearRemoteSnapshot, readRemoteSnapshot, updateRemoteSnapshot } from '@/data/snapshot';

const COVERS: CoverColor[] = ['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft'];

let refreshTimer: number | undefined;
/** Guards against stacking full refetches when realtime events arrive in bursts. */
let refreshInFlight = false;
let refreshQueued = false;

const PERF_KEY = 'journeybook:performance';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REMOTE = backend.kind === 'pocketbase';

/** Hidden performance mode (canvas lighting -> CSS fallback). No UI toggle yet. */
function initialPerformance(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('perf');
    if (q === '1') return true;
    if (q === '0') return false;
    return localStorage.getItem(PERF_KEY) === '1';
  } catch {
    return false;
  }
}

export type Viewport = 'desktop' | 'mobile';

export const useAppStore = defineStore('app', {
  state: () => ({
    data: loadData() ?? createEmptyData(),
    synced: false,
    /** Remote backend: true until the first successful load. */
    loading: REMOTE,
    /** Remote backend: true when the last load failed. */
    loadError: false,
    /** Remote backend: showing the last successfully synced snapshot. */
    offline: false,
    offlineSavedAt: 0,
    subscribed: false,
    /** Pause realtime refreshes while an editor draft is open. */
    syncPaused: false,
    /** Bumped when album URLs change so dependent renders refresh. */
    mediaVersion: 0,
    imagePresets: [] as ImagePreset[],
    /** Recoverable, soft-deleted items. */
    trash: [] as TrashItem[],
    /** When true, room lighting falls back to the CSS layer (cheaper). */
    performanceMode: initialPerformance(),
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
      return (bookId: string): MediaAsset[] =>
        s.data.content.media.filter((m) => m.bookId === bookId);
    },
    assetUrl: (s) => {
      return (id: string, thumb?: string): string => {
        void s.mediaVersion;
        return mediaUrl(
          s.data.content.media.find((m) => m.id === id),
          thumb,
        );
      };
    },
    integrity: (s) => auditIntegrity(s.data),
  },
  actions: {
    save() {
      try {
        backend.persistLocal(this.data);
      } catch (e) {
        console.error('save', e);
        notify('error', "Couldn't save changes", 'This browser is out of storage space.');
      }
    },
    /** Toggle performance mode (no UI yet); persisted for the browser. */
    setPerformanceMode(value: boolean) {
      this.performanceMode = value;
      try {
        localStorage.setItem(PERF_KEY, value ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    reset() {
      clearData();
      this.data = createEmptyData();
      this.save();
    },

    // ---- backend lifecycle ----
    async initBackend() {
      if (!REMOTE) {
        this.synced = true;
        this.loading = false;
        await this.resolveMedia();
        await this.loadImagePresets();
        await this.loadTrash();
        await this.expireTrash();
        return;
      }
      this.loading = true;
      this.loadError = false;
      await refreshMediaToken();
      try {
        const data = await backend.fetchAll();
        if (data) this.data = data;
        if (!this.subscribed) {
          backend.subscribe(() => this.scheduleRefresh());
          this.subscribed = true;
        }
        this.offline = false;
        this.offlineSavedAt = 0;
        updateRemoteSnapshot({ data: this.data });
        this.synced = true;
      } catch (e) {
        console.error('initBackend', e);
        const status = (e as { status?: number }).status;
        if (status === 401) {
          // A stale browser session must return to login instead of trapping
          // the tab on the load-error screen forever.
          await this.resetLocalSession();
          return;
        }
        const snapshot = readRemoteSnapshot();
        if (snapshot?.data) {
          this.data = snapshot.data;
          this.offline = true;
          this.offlineSavedAt = snapshot.savedAt;
          this.loadError = false;
          this.loading = false;
          notify(
            'info',
            'Showing the last saved copy',
            'Changes will sync when the connection returns.',
          );
          await this.resolveMedia();
          await this.loadImagePresets();
          await this.loadTrash();
          return;
        }
        this.loadError = true;
        this.loading = false;
        notify('error', "Couldn't load your memories", 'Check your connection and try again.');
        return;
      }
      this.loading = false;
      await this.resolveMedia();
      await this.loadImagePresets();
      await this.loadTrash();
    },
    async retryInit() {
      await this.initBackend();
    },
    /**
     * Drop browser-only stale state (session, snapshot, service worker/cache)
     * without touching server data. Useful when an old tab cannot recover.
     */
    async resetLocalSession() {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith('journeybook-shell-'))
              .map((key) => caches.delete(key)),
          );
        }
      } catch (error) {
        console.error('resetLocalSession', error);
      }
      clearRemoteSnapshot();
      clearMediaToken();
      pb?.authStore.clear();
      window.location.reload();
    },
    async loadTrash() {
      try {
        this.trash = await backend.listTrash();
        if (REMOTE) updateRemoteSnapshot({ trash: this.trash });
      } catch (e) {
        console.error('loadTrash', e);
        this.trash = readRemoteSnapshot()?.trash ?? [];
      }
    },
    /** Local mode mirrors the server's 30-day retention. */
    async expireTrash() {
      if (backend.kind !== 'local') return;
      const cutoff = Date.now() - TRASH_RETENTION_MS;
      const expired = this.trash.filter((item) => item.deletedAt < cutoff);
      for (const item of expired) await this.purgeItem(item);
      if (expired.length) this.trash = this.trash.filter((item) => !expired.includes(item));
    },
    /** Soft-delete a group of records and remember it for restore. */
    trashRecords(kind: TrashKind, label: string, records: TrashRecordRef[], detail?: string) {
      const item: TrashItem = { id: newId(), kind, label, detail, deletedAt: Date.now(), records };
      this.trash.unshift(item);
      backend.trash(item);
    },
    async restoreItem(item: TrashItem) {
      await backend.restoreTrash(item);
      this.trash = this.trash.filter((t) => t.id !== item.id);
      await this.reload();
      await this.loadImagePresets();
    },
    async purgeItem(item: TrashItem) {
      for (const ref of item.records) {
        if (ref.collection === 'media') releaseMediaUrl(ref.id);
      }
      await backend.purgeTrash(item);
      this.trash = this.trash.filter((t) => t.id !== item.id);
    },
    async emptyTrash() {
      const items = [...this.trash];
      for (const item of items) await this.purgeItem(item);
      this.trash = [];
    },
    /** Remove records left dangling by an interrupted cascade. */
    cleanOrphans() {
      const nodeIds = new Set(this.data.content.nodes.map((n) => n.id));
      const pageIds = new Set(this.data.content.pages.map((p) => p.id));
      const mediaIds = new Set(this.data.content.media.map((m) => m.id));
      const roomItemIds = new Set(this.data.roomItems.map((item) => item.id));
      const badPages = this.data.content.pages.filter((p) => !nodeIds.has(p.bookId));
      const badMedia = this.data.content.media.filter((m) => !nodeIds.has(m.bookId));
      const validMediaIds = new Set(mediaIds);
      for (const media of badMedia) validMediaIds.delete(media.id);
      const badElements = this.data.content.elements.filter(
        (e) =>
          !pageIds.has(e.pageId) ||
          (e.kind === 'image' && !!e.mediaId && !validMediaIds.has(e.mediaId)),
      );
      for (const page of badPages) backend.pageDelete(page.id);
      for (const element of badElements) backend.elementDelete(element.id);
      if (badMedia.length) {
        this.trashRecords(
          'media',
          'Orphaned photos',
          badMedia.map((m) => ({ collection: 'media', id: m.id, record: clone(m) })),
          `${badMedia.length}`,
        );
      }
      for (const item of this.data.roomItems) {
        if (item.attachTo && !roomItemIds.has(item.attachTo)) {
          item.attachTo = undefined;
          backend.roomItemUpdate(item);
        }
      }
      const badPageIds = new Set(badPages.map((p) => p.id));
      const badElementIds = new Set(badElements.map((e) => e.id));
      this.data.content.pages = this.data.content.pages.filter((p) => !badPageIds.has(p.id));
      this.data.content.elements = this.data.content.elements.filter(
        (e) => !badElementIds.has(e.id),
      );
      this.data.content.media = this.data.content.media.filter((m) => nodeIds.has(m.bookId));
      this.save();
    },
    async reload() {
      if (!REMOTE) {
        this.data = loadData() ?? this.data;
      } else {
        await pbOutbox?.whenIdle();
        await this.refreshFromBackend();
      }
      await this.resolveMedia();
      this.mediaVersion++;
    },
    async resolveMedia() {
      pruneMediaUrls(new Set(this.data.content.media.map((media) => media.id)));
      await hydrateMedia(this.data.content.media);
      this.mediaVersion++;
    },
    async loadImagePresets() {
      try {
        this.imagePresets = await backend.listImagePresets();
        if (REMOTE) updateRemoteSnapshot({ presets: this.imagePresets });
      } catch (e) {
        console.error('loadImagePresets', e);
        this.imagePresets = readRemoteSnapshot()?.presets ?? [];
      }
    },
    async saveImagePreset(preset: ImagePreset) {
      const idx = this.imagePresets.findIndex((p) => p.id === preset.id);
      if (idx >= 0) this.imagePresets[idx] = preset;
      else this.imagePresets.push(preset);
      await backend.saveImagePreset(preset);
    },
    async deleteImagePreset(id: string) {
      const preset = this.imagePresets.find((item) => item.id === id);
      if (!preset) return;
      this.trashRecords('preset', preset.name || 'Image preset', [
        { collection: 'image_presets', id, record: clone(preset) },
      ]);
      this.imagePresets = this.imagePresets.filter((p) => p.id !== id);
    },
    async ensureAsset(id: string) {
      const asset = this.data.content.media.find((m) => m.id === id);
      if (!asset || mediaUrl(asset)) return;
      await ensureMedia(asset);
      if (mediaUrl(asset)) this.mediaVersion++;
    },
    scheduleRefresh() {
      if (this.syncPaused) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void this.refreshFromBackend(), 250);
    },
    setSyncPaused(value: boolean) {
      this.syncPaused = value;
      // Catch up with anything that changed while the editor was open.
      if (!value) this.scheduleRefresh();
    },
    async refreshFromBackend() {
      if (backend.kind === 'local' || this.syncPaused) return;
      // Never clobber optimistic state while writes are still queued.
      if (pbOutbox && pbOutbox.size() > 0) {
        this.scheduleRefresh();
        return;
      }
      // A burst of realtime events must not stack full fetches: queue one and
      // let the in-flight refresh pick it up when it finishes.
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        const data = await backend.fetchAll();
        if (data) {
          this.data = data;
          this.offline = false;
          this.offlineSavedAt = 0;
          updateRemoteSnapshot({ data: this.data });
          await this.resolveMedia();
        }
      } catch (e) {
        console.error('refreshFromBackend', e);
      } finally {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          this.scheduleRefresh();
        }
      }
    },

    // ---- book content ----
    node(id: string): ScrapNode | undefined {
      return this.data.content.nodes.find((n) => n.id === id);
    },
    childrenOf(parentId: string | null): ScrapNode[] {
      return this.data.content.nodes
        .filter((n) => n.parentId === parentId)
        .sort((a, b) => a.order - b.order);
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
      const node = this.node(id);
      const doomed = new Set<string>();
      const collect = (rootId: string) => {
        doomed.add(rootId);
        this.data.content.nodes.filter((n) => n.parentId === rootId).forEach((c) => collect(c.id));
      };
      collect(id);
      const pages = this.data.content.pages.filter((p) => doomed.has(p.bookId));
      const pageIds = new Set(pages.map((p) => p.id));
      const records: TrashRecordRef[] = [
        ...this.data.content.nodes
          .filter((n) => doomed.has(n.id))
          .map((n) => ({ collection: 'nodes', id: n.id, record: clone(n) })),
        ...pages.map((p) => ({ collection: 'pages', id: p.id, record: clone(p) })),
        ...this.data.content.elements
          .filter((e) => pageIds.has(e.pageId))
          .map((e) => ({ collection: 'elements', id: e.id, record: clone(e) })),
        ...this.data.content.media
          .filter((m) => doomed.has(m.bookId))
          .map((m) => ({ collection: 'media', id: m.id, record: clone(m) })),
      ];
      this.trashRecords(
        'book',
        node?.title ?? 'Book',
        records,
        `${records.length} item${records.length === 1 ? '' : 's'}`,
      );
      this.data.content.nodes = this.data.content.nodes.filter((n) => !doomed.has(n.id));
      this.data.content.pages = this.data.content.pages.filter((p) => !doomed.has(p.bookId));
      this.data.content.elements = this.data.content.elements.filter((e) => !pageIds.has(e.pageId));
      this.data.content.media = this.data.content.media.filter((m) => !doomed.has(m.bookId));
      this.save();
    },

    // ---- pages ----
    pagesOf(bookId: string): ScrapPage[] {
      return this.data.content.pages
        .filter((p) => p.bookId === bookId)
        .sort((a, b) => a.index - b.index);
    },
    elementsOf(pageId: string): PageElement[] {
      return this.data.content.elements
        .filter((e) => e.pageId === pageId)
        .sort((a, b) => a.z - b.z);
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
      const elements = this.data.content.elements.filter((e) => e.pageId === pageId);
      const records: TrashRecordRef[] = [
        { collection: 'pages', id: pageId, record: clone(page) },
        ...elements.map((e) => ({ collection: 'elements', id: e.id, record: clone(e) })),
      ];
      this.trashRecords('page', `Page ${page.index + 1}`, records);
      this.data.content.pages = this.data.content.pages.filter((p) => p.id !== pageId);
      this.data.content.elements = this.data.content.elements.filter((e) => e.pageId !== pageId);
      this.save();
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
      const asset: MediaAsset = {
        id: newId(),
        bookId,
        name: prepared.name || 'photo',
        created: Date.now(),
      };
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
      const used = this.data.content.elements.filter(
        (element) => element.kind === 'image' && element.mediaId === id,
      );
      // Keep the photo and every placed crop together so a restore is complete
      // and a page never keeps a reference to missing bytes.
      this.trashRecords(
        'media',
        asset.name || 'Photo',
        [
          { collection: 'media', id, record: clone(asset) },
          ...used.map((element) => ({
            collection: 'elements',
            id: element.id,
            record: clone(element),
          })),
        ],
        used.length ? `${used.length} placed` : undefined,
      );
      const usedIds = new Set(used.map((element) => element.id));
      this.data.content.elements = this.data.content.elements.filter(
        (element) => !usedIds.has(element.id),
      );
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
        desktop: {
          x: 0.5,
          y: 0.5,
          scale: cat.defaultScale,
          rotation: cat.defaultRotation,
          flip: false,
        },
      };
      this.data.roomItems.push(item);
      this.save();
      backend.roomItemCreate(item);
      return item;
    },
    removeRoomItem(id: string) {
      for (const child of this.data.roomItems.filter((item) => item.attachTo === id)) {
        child.attachTo = undefined;
        backend.roomItemUpdate(child);
      }
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
      const ids = new Set(this.data.roomItems.map((item) => item.id));
      for (const item of this.data.roomItems) {
        if (item.attachTo && !ids.has(item.attachTo)) item.attachTo = undefined;
      }
      this.save();
      backend.applyRoomLayout(this.data.room, this.data.roomItems);
    },
    async listLayouts(): Promise<StoredLayout[]> {
      try {
        const layouts = await backend.listLayouts();
        if (REMOTE) updateRemoteSnapshot({ layouts });
        return layouts;
      } catch (e) {
        console.error('listLayouts', e);
        return readRemoteSnapshot()?.layouts ?? [];
      }
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
      const layout = (await this.listLayouts()).find((item) => item.id === id);
      if (!layout) return;
      this.trashRecords('layout', layout.name || 'Room layout', [
        { collection: 'room_layouts', id, record: clone(layout) },
      ]);
    },

    // ---- calendar ----
    saveEvent(event: CalendarEvent) {
      const idx = this.data.events.findIndex((e) => e.id === event.id);
      if (idx >= 0) this.data.events[idx] = clone(event);
      else this.data.events.push(clone(event));
      this.save();
      backend.eventSave(event);
    },
    deleteEvent(id: string) {
      const event = this.data.events.find((e) => e.id === id);
      if (!event) return;
      this.trashRecords('event', event.title || 'Event', [
        { collection: 'events', id, record: clone(event) },
      ]);
      this.data.events = this.data.events.filter((e) => e.id !== id);
      this.save();
    },
  },
});

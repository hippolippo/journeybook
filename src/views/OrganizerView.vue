<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import type { ScrapNode } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useViewport } from '@/composables/useViewport';
import { duplicateBook, exportBookData, importBookData } from '@/data/bookTransfer';
import { stickerById } from '@/scrapbook/decor';

const pressedFlower = stickerById('daisy').art;

const props = defineProps<{ folderId?: string }>();
const app = useAppStore();
const router = useRouter();
const { isMobile } = useViewport();

/** Optional route params arrive as an empty string on direct load; normalize. */
const folderId = computed(() => props.folderId || null);
const folder = computed(() => (folderId.value ? app.node(folderId.value) : undefined));
const kids = computed(() => app.childrenOf(folderId.value));
const crumbs = computed(() => app.breadcrumb(folderId.value));

const creating = ref<null | 'folder' | 'scrapbook'>(null);
const newTitle = ref('');
const newInput = ref<HTMLInputElement | null>(null);
const menuOpen = ref<string | null>(null);
const menuPos = ref({ top: 0, left: 0 });
const menuNode = computed(() => (menuOpen.value ? app.node(menuOpen.value) : undefined));

/** Direct-child and page totals indexed once, so tiles don't refilter per render. */
const childCountByParent = computed(() => {
  const map = new Map<string, number>();
  for (const node of app.data.content.nodes) {
    const key = node.parentId ?? '';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
});
const pageCountByBook = computed(() => {
  const map = new Map<string, number>();
  for (const page of app.data.content.pages) {
    map.set(page.bookId, (map.get(page.bookId) ?? 0) + 1);
  }
  return map;
});

interface Entry {
  key: string;
  kind: 'form' | 'node';
  node?: ScrapNode;
}

/** Row-major order across the two-row column-wrap shelf. */
const entries = computed<Entry[]>(() => {
  const list: Entry[] = [];
  if (creating.value) list.push({ key: '__form', kind: 'form' });
  for (const node of kids.value) list.push({ key: node.id, kind: 'node', node });
  const half = Math.ceil(list.length / 2);
  const out: Entry[] = [];
  for (let r = 0; r < half; r++) {
    if (list[r]) out.push(list[r]);
    if (list[r + half]) out.push(list[r + half]);
  }
  return out;
});

function rotFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${(((h % 5) - 2) * 0.5).toFixed(2)}deg`;
}
function contentCount(id: string): number {
  return childCountByParent.value.get(id) ?? 0;
}
function pageCount(id: string): number {
  return pageCountByBook.value.get(id) ?? 0;
}

function openFolder(id: string | null) {
  if (id) router.push({ name: 'organizer', params: { folderId: id } });
  else router.push({ name: 'organizer' });
}
function openBook(id: string) {
  router.push({ name: 'book', params: { bookId: id } });
}

function startCreate(type: 'folder' | 'scrapbook') {
  if (isMobile.value) return;
  creating.value = type;
  newTitle.value = '';
  nextTick(() => newInput.value?.focus());
}
function submitCreate() {
  const title = newTitle.value.trim();
  if (!title || !creating.value) return;
  app.createNode(creating.value, folderId.value, title);
  creating.value = null;
  newTitle.value = '';
}
function toggleMenu(node: ScrapNode, event: Event) {
  if (isMobile.value) return;
  if (menuOpen.value === node.id) {
    menuOpen.value = null;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const width = 210;
  const height = 230;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height) : rect.bottom + 6;
  menuPos.value = { top, left };
  menuOpen.value = node.id;
}
function closeMenu() {
  menuOpen.value = null;
}
function rename(node: ScrapNode) {
  const next = window.prompt('Rename to…', node.title);
  if (next && next.trim()) app.renameNode(node.id, next.trim());
  menuOpen.value = null;
}
function remove(node: ScrapNode) {
  const extra = node.type === 'folder' ? ' and everything inside' : '';
  if (window.confirm(`Delete "${node.title}"${extra}?`)) app.deleteNode(node.id);
  menuOpen.value = null;
}
function togglePublished(node: ScrapNode) {
  app.updateNode(node.id, { published: !node.published });
  menuOpen.value = null;
}
async function duplicate(node: ScrapNode) {
  menuOpen.value = null;
  try {
    await duplicateBook(node.id);
  } catch (e) {
    console.error(e);
  }
}
async function exportBook(node: ScrapNode) {
  menuOpen.value = null;
  try {
    const json = await exportBookData(node.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(node.title || 'book').replace(/[^\w.-]+/g, '_')}.journeybook.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    window.alert('Could not export this book.');
  }
}
const importInput = ref<HTMLInputElement | null>(null);
async function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const node = await importBookData(await file.text(), folderId.value);
    openBook(node.id);
  } catch (err) {
    console.error(err);
    window.alert('Could not import this file.');
  }
}

const tilesEl = ref<HTMLElement | null>(null);
const canPrev = ref(false);
const canNext = ref(false);
function updateArrows() {
  const el = tilesEl.value;
  if (!el) {
    canPrev.value = false;
    canNext.value = false;
    return;
  }
  const overflow = el.scrollWidth > el.clientWidth + 1;
  canPrev.value = overflow && el.scrollLeft > 1;
  canNext.value = overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}
function scrollDir(dir: number) {
  const el = tilesEl.value;
  if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
}
function onTilesScroll() {
  updateArrows();
  if (menuOpen.value) menuOpen.value = null;
}

onMounted(() => {
  nextTick(updateArrows);
  window.addEventListener('resize', updateArrows);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateArrows));
watch(entries, () => nextTick(updateArrows));
</script>

<template>
  <h1 class="sr-only">{{ folder ? folder.title : 'Scrapbooks' }}</h1>

  <nav class="crumbs" aria-label="Breadcrumb">
    <button
      class="crumb"
      type="button"
      :aria-current="!folder ? 'true' : undefined"
      @click="openFolder(null)"
    >
      Scrapbooks
    </button>
    <template v-for="node in crumbs" :key="node.id">
      <span class="crumb-sep" aria-hidden="true">/</span>
      <button
        class="crumb"
        type="button"
        :aria-current="folder && node.id === folder.id ? 'true' : undefined"
        @click="openFolder(node.id)"
      >
        {{ node.title }}
      </button>
    </template>
  </nav>

  <div v-if="!isMobile" class="toolbar">
    <button class="btn btn--primary" type="button" @click="startCreate('folder')">
      <Icon name="folder" />New folder
    </button>
    <button class="btn btn--sage" type="button" @click="startCreate('scrapbook')">
      <Icon name="book" />New scrapbook
    </button>
    <button class="btn" type="button" @click="importInput?.click()">
      <Icon name="plus" />Import book
    </button>
    <input ref="importInput" class="visually-hidden" type="file" accept=".json,application/json" @change="onImport" />
  </div>

  <div v-if="kids.length || creating" class="items-wrap">
    <button
      v-show="canPrev"
      class="items-arrow items-arrow--prev"
      type="button"
      aria-label="More to the left"
      @click="scrollDir(-1)"
    >
      <Icon name="chev-left" />
    </button>
    <div ref="tilesEl" class="tiles" @scroll="onTilesScroll">
      <template v-for="entry in entries" :key="entry.key">
        <form
          v-if="entry.kind === 'form'"
          class="create-form"
          @submit.prevent="submitCreate"
        >
          <label>{{ creating === 'folder' ? 'Name your folder' : 'Name your scrapbook' }}</label>
          <input
            ref="newInput"
            v-model="newTitle"
            type="text"
            placeholder="e.g. Summer 2024"
            autocomplete="off"
            required
          />
          <div class="row">
            <button class="btn btn--primary btn--small" type="submit">Create</button>
            <button class="btn btn--ghost btn--small" type="button" @click="creating = null">
              Cancel
            </button>
          </div>
        </form>

        <div
          v-else-if="entry.node && entry.node.type === 'folder'"
          class="tile"
          role="button"
          tabindex="0"
          :style="{ '--rot': rotFor(entry.key) }"
          @click="openFolder(entry.node.id)"
          @keydown.enter="openFolder(entry.node.id)"
        >
          <div class="folder">
            <span class="folder__peek" aria-hidden="true"></span>
            <span class="folder__peek folder__peek--2" aria-hidden="true"></span>
            <span class="folder__meta">
              {{ contentCount(entry.node.id) }}
              {{ contentCount(entry.node.id) === 1 ? 'thing' : 'things' }}
            </span>
            <span class="folder__title">{{ entry.node.title }}</span>
          </div>
          <button
            v-if="!isMobile"
            class="tile-menu"
            type="button"
            aria-label="More"
            @click.stop="toggleMenu(entry.node, $event)"
          >
            <Icon name="menu" />
          </button>
        </div>

        <div
          v-else-if="entry.node"
          class="tile"
          role="button"
          tabindex="0"
          :style="{ '--rot': rotFor(entry.key) }"
          @click="openBook(entry.node.id)"
          @keydown.enter="openBook(entry.node.id)"
        >
          <div class="book" :data-cover="entry.node.cover" :data-draft="entry.node.published ? undefined : 'true'">
            <span class="book__label"><span class="book__title">{{ entry.node.title }}</span></span>
            <span class="book__meta">
              {{ pageCount(entry.node.id) }}
              {{ pageCount(entry.node.id) === 1 ? 'page' : 'pages' }}
            </span>
            <span v-if="!entry.node.published" class="book__draft">Draft</span>
          </div>
          <button
            v-if="!isMobile"
            class="tile-menu"
            type="button"
            aria-label="More"
            @click.stop="toggleMenu(entry.node, $event)"
          >
            <Icon name="menu" />
          </button>
        </div>
      </template>
    </div>
    <button
      v-show="canNext"
      class="items-arrow items-arrow--next"
      type="button"
      aria-label="More to the right"
      @click="scrollDir(1)"
    >
      <Icon name="chev-right" />
    </button>
  </div>

  <div v-else class="items-wrap">
    <div class="empty">
      <img :src="pressedFlower" alt="" aria-hidden="true" />
      <h3>This room is empty</h3>
      <p v-if="isMobile">Nothing here yet.</p>
      <p v-else>Make your first folder or scrapbook?</p>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="menuNode" class="tile-backdrop" @click="closeMenu"></div>
    <div
      v-if="menuNode"
      class="tile-pop tile-pop--fixed"
      :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
    >
      <button type="button" @click="rename(menuNode)">Rename</button>
      <template v-if="menuNode.type === 'scrapbook'">
        <button type="button" @click="togglePublished(menuNode)">
          {{ menuNode.published ? 'Unpublish' : 'Publish' }}
        </button>
        <button type="button" @click="duplicate(menuNode)">Duplicate</button>
        <button type="button" @click="exportBook(menuNode)">Export to file</button>
      </template>
      <button class="is-danger" type="button" @click="remove(menuNode)">Delete</button>
    </div>
  </Teleport>
</template>

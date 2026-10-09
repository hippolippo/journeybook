<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ScrapNode } from '@/data/types';
import { useAppStore } from '@/stores/app';
import pressedFlower from '@/assets/svg/pressed-flower.svg';

const props = defineProps<{ folderId?: string }>();
const app = useAppStore();
const router = useRouter();

const folder = computed(() => (props.folderId ? app.node(props.folderId) : undefined));
const kids = computed(() => app.childrenOf(props.folderId ?? null));
const crumbs = computed(() => app.breadcrumb(props.folderId ?? null));

const creating = ref<null | 'folder' | 'scrapbook'>(null);
const newTitle = ref('');
const newInput = ref<HTMLInputElement | null>(null);
const menuOpen = ref<string | null>(null);

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
  return app.childrenOf(id).length;
}
function pageCount(id: string): number {
  return app.pagesOf(id).length;
}

function openFolder(id: string | null) {
  if (id) router.push({ name: 'organizer', params: { folderId: id } });
  else router.push({ name: 'organizer' });
}
function openBook(id: string) {
  router.push({ name: 'book', params: { bookId: id } });
}

function startCreate(type: 'folder' | 'scrapbook') {
  creating.value = type;
  newTitle.value = '';
  nextTick(() => newInput.value?.focus());
}
function submitCreate() {
  const title = newTitle.value.trim();
  if (!title || !creating.value) return;
  app.createNode(creating.value, props.folderId ?? null, title);
  creating.value = null;
  newTitle.value = '';
}
function toggleMenu(id: string) {
  menuOpen.value = menuOpen.value === id ? null : id;
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

  <div class="toolbar">
    <button class="btn btn--primary" type="button" @click="startCreate('folder')">
      <span class="icon icon--folder"></span>New folder
    </button>
    <button class="btn btn--sage" type="button" @click="startCreate('scrapbook')">
      <span class="icon icon--book"></span>New scrapbook
    </button>
  </div>

  <div v-if="kids.length || creating" class="items-wrap">
    <button
      v-show="canPrev"
      class="items-arrow items-arrow--prev"
      type="button"
      aria-label="More to the left"
      @click="scrollDir(-1)"
    >
      <span class="icon icon--chev-left"></span>
    </button>
    <div ref="tilesEl" class="tiles" @scroll="updateArrows">
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
          <button class="tile-menu" type="button" aria-label="More" @click.stop="toggleMenu(entry.node.id)">
            <span class="icon icon--menu"></span>
          </button>
          <div v-if="menuOpen === entry.node.id" class="tile-pop">
            <button type="button" @click.stop="rename(entry.node)">Rename</button>
            <button class="is-danger" type="button" @click.stop="remove(entry.node)">Delete</button>
          </div>
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
          <div class="book" :data-cover="entry.node.cover">
            <span class="book__label"><span class="book__title">{{ entry.node.title }}</span></span>
            <span class="book__meta">
              {{ pageCount(entry.node.id) }}
              {{ pageCount(entry.node.id) === 1 ? 'page' : 'pages' }}
            </span>
          </div>
          <button class="tile-menu" type="button" aria-label="More" @click.stop="toggleMenu(entry.node.id)">
            <span class="icon icon--menu"></span>
          </button>
          <div v-if="menuOpen === entry.node.id" class="tile-pop">
            <button type="button" @click.stop="rename(entry.node)">Rename</button>
            <button class="is-danger" type="button" @click.stop="remove(entry.node)">Delete</button>
          </div>
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
      <span class="icon icon--chev-right"></span>
    </button>
  </div>

  <div v-else class="items-wrap">
    <div class="empty">
      <img :src="pressedFlower" alt="" aria-hidden="true" />
      <h3>This room is empty</h3>
      <p>Make your first folder or scrapbook?</p>
    </div>
  </div>
</template>

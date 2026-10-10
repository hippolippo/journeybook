<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { usePageEditorStore } from '@/stores/pageEditor';
import { useViewport } from '@/composables/useViewport';
import { clampStart, lastStart, pageRange } from '@/room/pagination';
import PageCanvas from '@/components/PageCanvas.vue';
import PageEditor from '@/scrapbook/PageEditor.vue';
import polaroidEmpty from '@/assets/svg/polaroid-empty.svg';

/** The page is authored at this fixed logical size, then uniformly scaled. */
const PAGE = 480;

const props = defineProps<{ bookId: string }>();
const app = useAppStore();
const pe = usePageEditorStore();
const { isMobile } = useViewport();
const router = useRouter();

function editPage(index: number) {
  const page = pages.value[index];
  if (page) pe.start(props.bookId, page.id);
}

const book = computed(() => app.node(props.bookId));
const published = computed(() => !!book.value?.published);
const pages = computed(() => app.pagesOf(props.bookId));

function unpublish() {
  app.updateNode(props.bookId, { published: false });
}

const spreadEl = ref<HTMLElement | null>(null);
const avail = ref({ w: 600, h: 600 });
let observer: ResizeObserver | null = null;

function measure() {
  const el = spreadEl.value;
  if (el) avail.value = { w: el.clientWidth, h: el.clientHeight };
  clampPan();
}
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && spreadEl.value) {
    observer = new ResizeObserver(measure);
    observer.observe(spreadEl.value);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('resize', measure);
  window.removeEventListener('keydown', onKey);
});

const perView = computed(() => (avail.value.w >= 720 && avail.value.h >= 340 ? 2 : 1));
const pageSize = computed(() => {
  const pv = perView.value;
  const usableW = avail.value.w - 24 * (pv - 1) - 16;
  const s = Math.min(usableW / pv, avail.value.h - 16);
  return Math.max(120, Math.floor(s));
});
const spreadStyle = computed(() => ({
  '--page-size': `${pageSize.value}px`,
  '--page-scale': String(pageSize.value / PAGE),
}));

const pagesMenu = ref(false);
const start = ref(0);
const clamped = computed(() => clampStart(start.value, pages.value.length, perView.value));
const visible = computed(() => pageRange(clamped.value, pages.value.length, perView.value));
const atStart = computed(() => clamped.value <= 0);
const atEnd = computed(() => clamped.value >= lastStart(pages.value.length, perView.value));
const label = computed(() => {
  const n = pages.value.length;
  if (n === 0) return 'blank book';
  const from = clamped.value + 1;
  const to = Math.min(clamped.value + perView.value, n);
  return perView.value === 1 ? `page ${from} of ${n}` : `pages ${from}${to > from ? '–' + to : ''} of ${n}`;
});

watch([perView, () => props.bookId], () => {
  start.value = 0;
});

function prev() {
  start.value = clampStart(clamped.value - perView.value, pages.value.length, perView.value);
}
function next() {
  start.value = clampStart(clamped.value + perView.value, pages.value.length, perView.value);
}
function back() {
  const b = book.value;
  if (!b) return;
  router.push(
    b.parentId ? { name: 'organizer', params: { folderId: b.parentId } } : { name: 'organizer' },
  );
}
function elementsOf(pageId: string) {
  return app.elementsOf(pageId);
}
/* -------------------- double-tap zoom -------------------- */
const zoomIndex = ref<number | null>(null);
const zoomSize = computed(() => pageSize.value * 2);
const pan = ref({ x: 0, y: 0 });
const zoomStyle = computed(() => ({
  '--page-size': `${zoomSize.value}px`,
  '--page-scale': String(zoomSize.value / PAGE),
  transform: `translate(-50%, -50%) translate(${pan.value.x}px, ${pan.value.y}px)`,
}));

function clampPan() {
  if (zoomIndex.value === null) return;
  const mx = Math.max(0, (zoomSize.value - window.innerWidth) / 2);
  const my = Math.max(0, (zoomSize.value - window.innerHeight) / 2);
  pan.value = {
    x: Math.min(mx, Math.max(-mx, pan.value.x)),
    y: Math.min(my, Math.max(-my, pan.value.y)),
  };
}
function openZoom(index: number) {
  if (zoomIndex.value === index) return;
  zoomIndex.value = index;
  pan.value = { x: 0, y: 0 };
  clampPan();
}
function closeZoom() {
  zoomIndex.value = null;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeZoom();
}

const panStart = { x: 0, y: 0, px: 0, py: 0, active: false };
function onPanStart(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  panStart.x = e.clientX;
  panStart.y = e.clientY;
  panStart.px = pan.value.x;
  panStart.py = pan.value.y;
  panStart.active = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPanMove(e: PointerEvent) {
  if (!panStart.active) return;
  pan.value = { x: panStart.px + (e.clientX - panStart.x), y: panStart.py + (e.clientY - panStart.y) };
  clampPan();
}
function onPanEnd(e: PointerEvent) {
  panStart.active = false;
  const el = e.currentTarget as HTMLElement;
  if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
}

/* -------------------- double-tap detection -------------------- */
let lastTap = { t: 0, x: 0, y: 0, index: -1 };
function onPageTap(index: number, e: PointerEvent) {
  const now = Date.now();
  const near =
    Math.abs(e.clientX - lastTap.x) < 28 && Math.abs(e.clientY - lastTap.y) < 28;
  if (lastTap.index === index && now - lastTap.t < 350 && near) {
    lastTap = { t: 0, x: 0, y: 0, index: -1 };
    openZoom(index);
    return;
  }
  lastTap = { t: now, x: e.clientX, y: e.clientY, index };
}
</script>

<template>
  <div class="book-head">
    <button class="backlink" type="button" @click="back">
      <span class="icon icon--back"></span>{{ book ? 'Back' : 'Scrapbooks' }}
    </button>
    <span class="tag">{{ book ? book.title : 'Book' }}</span>
    <span v-if="book && !published" class="tag tag--draft">Draft</span>
    <button v-if="published && !isMobile" class="btn btn--small" type="button" @click="unpublish">Unpublish</button>
  </div>

  <div ref="spreadEl" class="spread" :style="spreadStyle">
    <div
      v-for="index in visible"
      :key="index"
      class="page-slot"
      @pointerup="onPageTap(index, $event)"
      @dblclick="openZoom(index)"
    >
      <div class="page-scaler">
        <PageCanvas :elements="elementsOf(pages[index].id)" :num="index + 1" :paper="pages[index].background" :paper-colors="pages[index].paperColors" />
      </div>
      <button
        v-if="!isMobile && !published"
        class="page-slot__edit"
        type="button"
        title="Edit this page"
        @click.stop="editPage(index)"
      >
        <span class="icon icon--pencil"></span>
      </button>
    </div>

    <div v-if="pages.length === 0" class="page-slot">
      <div class="page-scaler">
        <div class="square-page">
          <div class="empty" style="border: none; background: transparent">
            <img :src="polaroidEmpty" alt="" aria-hidden="true" />
            <h3>A blank book</h3>
            <p>Add your first memory?</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="book-controls">
    <div class="page-nav">
      <button class="page-nav__btn" type="button" :disabled="atStart" @click="prev">
        <span class="icon icon--chev-left"></span>
      </button>
      <span class="page-nav__label">{{ label }}</span>
      <button class="page-nav__btn" type="button" :disabled="atEnd" @click="next">
        <span class="icon icon--chev-right"></span>
      </button>
    </div>
    <div v-if="!isMobile && !published" class="add-bar pages-tools">
      <button class="btn btn--small" type="button" @click="app.addPage(bookId)">
        <span class="icon icon--plus"></span>Add page
      </button>
      <div class="pages-menu">
        <button class="btn btn--small" type="button" :aria-expanded="pagesMenu" @click="pagesMenu = !pagesMenu">
          <span class="icon icon--menu"></span>Manage pages
        </button>
        <div v-if="pagesMenu" class="pages-menu__pop">
          <div v-for="(p, idx) in pages" :key="p.id" class="pages-menu__row">
            <span class="pages-menu__thumb">
              <span class="page-scaler" style="--page-scale: 0.0833">
                <PageCanvas :elements="elementsOf(p.id)" :num="idx + 1" :paper="p.background" :paper-colors="p.paperColors" />
              </span>
            </span>
            <span class="pages-menu__label">Page {{ idx + 1 }}</span>
            <button class="layer-mini" type="button" title="Move earlier" :disabled="idx === 0" @click.stop="app.movePage(p.id, -1)">
              <span class="icon icon--chev-right rot-up"></span>
            </button>
            <button class="layer-mini" type="button" title="Move later" :disabled="idx === pages.length - 1" @click.stop="app.movePage(p.id, 1)">
              <span class="icon icon--chev-right rot-down"></span>
            </button>
            <button class="layer-mini" type="button" title="Remove page" @click.stop="app.removePage(p.id)">
              <span class="icon icon--trash"></span>
            </button>
          </div>
          <p v-if="pages.length === 0" class="editor__muted">No pages yet.</p>
        </div>
      </div>
    </div>

  </div>

  <Teleport to="body">
    <div
      v-if="zoomIndex !== null && pages[zoomIndex]"
      class="page-zoom"
      @pointerdown="onPanStart"
      @pointermove="onPanMove"
      @pointerup="onPanEnd"
      @pointercancel="onPanEnd"
    >
      <div class="page-slot page-zoom__pan" :style="zoomStyle">
        <div class="page-scaler">
          <PageCanvas :elements="elementsOf(pages[zoomIndex].id)" :num="zoomIndex + 1" :paper="pages[zoomIndex].background" :paper-colors="pages[zoomIndex].paperColors" />
        </div>
      </div>
      <button
        class="page-zoom__close"
        type="button"
        aria-label="Close"
        @pointerdown.stop
        @click="closeZoom"
      >
        ×
      </button>
    </div>
  </Teleport>

  <PageEditor />
</template>

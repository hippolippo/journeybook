<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { PageElement } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useViewport } from '@/composables/useViewport';
import { clampStart, lastStart, pageRange, pagesPerView } from '@/room/pagination';
import polaroidEmpty from '@/assets/svg/polaroid-empty.svg';

const props = defineProps<{ bookId: string }>();
const app = useAppStore();
const router = useRouter();
const { isMobile } = useViewport();

const book = computed(() => app.node(props.bookId));
const pages = computed(() => app.pagesOf(props.bookId));
const perView = computed(() => pagesPerView(!isMobile.value));
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
function elementsOf(pageId: string): PageElement[] {
  return app.elementsOf(pageId);
}
function elStyle(el: PageElement) {
  return {
    left: `${el.x * 100}%`,
    top: `${el.y * 100}%`,
    width: `${el.w * 100}%`,
    height: `${el.h * 100}%`,
    transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
    zIndex: String(el.z),
    opacity: String(el.opacity),
  };
}
function currentPageId(): string {
  const list = pages.value;
  if (list.length === 0) return app.addPage(props.bookId).id;
  return list[Math.min(clamped.value, list.length - 1)].id;
}
function addPhoto() {
  app.addElement(currentPageId(), {
    kind: 'photo',
    photo: 'sunset',
    caption: 'new memory',
    x: 0.5,
    y: 0.44,
    w: 0.5,
    h: 0.5,
    rotation: -2,
  });
}
function addNote() {
  app.addElement(currentPageId(), {
    kind: 'note',
    text: 'Write something sweet…',
    x: 0.5,
    y: 0.5,
    w: 0.52,
    h: 0.24,
    rotation: 2,
  });
}
function addSticker() {
  app.addElement(currentPageId(), {
    kind: 'sticker',
    icon: 'heart',
    x: 0.5,
    y: 0.5,
    w: 0.16,
    h: 0.16,
    rotation: -6,
  });
}
</script>

<template>
  <div class="book-head">
    <button class="backlink" type="button" @click="back">
      <span class="icon icon--back"></span>{{ book ? 'Back' : 'Scrapbooks' }}
    </button>
    <span class="tag">{{ book ? book.title : 'Book' }}</span>
  </div>

  <div class="spread">
    <div v-for="index in visible" :key="index" class="square-page">
      <div
        v-for="el in elementsOf(pages[index].id)"
        :key="el.id"
        class="el"
        :class="[
          el.kind === 'photo' ? 'el--photo' : '',
          el.kind === 'note' ? 'el--note' : '',
          el.kind === 'sticker' ? `el--sticker el--sticker--${el.icon}` : '',
        ]"
        :style="elStyle(el)"
      >
        <template v-if="el.kind === 'photo'">
          <span class="el__photo" :class="`el__photo--${el.photo}`"></span>
          <span class="cap">{{ el.caption }}</span>
        </template>
        <template v-else-if="el.kind === 'note'">{{ el.text }}</template>
      </div>
      <span class="square-page__num">{{ index + 1 }}</span>
      <span v-if="visible.length === 1" class="sr-only">page {{ index + 1 }}</span>
    </div>
    <div v-if="pages.length === 0" class="square-page">
      <div class="empty" style="border: none; background: transparent">
        <img :src="polaroidEmpty" alt="" aria-hidden="true" />
        <h3>A blank book</h3>
        <p>Add your first memory?</p>
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
    <div class="add-bar">
      <button class="btn btn--small" type="button" @click="addPhoto">
        <span class="icon icon--camera"></span>Add photo
      </button>
      <button class="btn btn--small" type="button" @click="addNote">
        <span class="icon icon--pencil"></span>Add note
      </button>
      <button class="btn btn--small" type="button" @click="addSticker">
        <span class="icon icon--star"></span>Add sticker
      </button>
      <button class="btn btn--small" type="button" @click="app.addPage(bookId)">
        <span class="icon icon--plus"></span>Add page
      </button>
    </div>
  </div>
</template>

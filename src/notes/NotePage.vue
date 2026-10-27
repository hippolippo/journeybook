<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { notePaperById } from '@/scrapbook/notes';
import {
  NOTE_PAGE_WIDTH,
  NOTE_MAX_HEIGHT,
  NOTE_MIN_HEIGHT,
  notePaperStyle,
  noteTextMetrics,
} from '@/notes/page';

const props = defineProps<{
  paper: string;
  paperColor?: string;
  height: number;
  scale: number;
  mirrorHtml: string;
  editable: boolean;
}>();

const emit = defineEmits<{
  'update:height': [value: number];
  overflow: [value: number];
}>();

const content = ref<HTMLDivElement | null>(null);
const spill = ref<HTMLDivElement | null>(null);
const overflow = ref(0);

const paper = computed(() => notePaperById(props.paper));
const texture = computed(() => paper.value.texture);
const pageStyle = computed(() => notePaperStyle(paper.value, props.paperColor, texture.value));
const contentStyle = computed(() => {
  const metrics = noteTextMetrics(paper.value);
  return {
    lineHeight: `${metrics.lineHeight}px`,
    paddingTop: `${metrics.paddingTop}px`,
  };
});
const frameStyle = computed(() => ({
  width: `${NOTE_PAGE_WIDTH * props.scale}px`,
  height: `${props.height * props.scale}px`,
}));
const innerStyle = computed(() => ({
  width: `${NOTE_PAGE_WIDTH}px`,
  height: `${props.height}px`,
  transform: `scale(${props.scale})`,
  transformOrigin: 'top left',
  ...pageStyle.value,
}));

function updateOverflow(): void {
  const root = content.value;
  if (!root) return;
  const full = Math.max(root.scrollHeight, props.height);
  overflow.value = Math.max(0, root.scrollHeight - props.height);
  const mirror = spill.value;
  if (mirror) {
    mirror.style.height = `${full}px`;
    mirror.style.clipPath = `inset(${props.height}px 0 0 0)`;
    mirror.style.setProperty('-webkit-clip-path', `inset(${props.height}px 0 0 0)`);
  }
  emit('overflow', overflow.value);
}

let observer: ResizeObserver | undefined;

onMounted(() => {
  void nextTick(updateOverflow);
  if (typeof ResizeObserver !== 'undefined' && content.value) {
    observer = new ResizeObserver(() => updateOverflow());
    observer.observe(content.value);
  }
  if (document.fonts?.ready) void document.fonts.ready.then(updateOverflow);
});

watch(
  () => [props.mirrorHtml, props.height, props.scale],
  () => void nextTick(updateOverflow),
);

function findScroller(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    if (/(auto|scroll)/.test(window.getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

const RESIZE_EDGE_PX = 96;
const RESIZE_MIN_SPEED = 140;
const RESIZE_MAX_SPEED = 720;

function startResize(event: PointerEvent): void {
  if (!props.editable) return;
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = props.height;
  const scale = props.scale || 1;
  const target = event.currentTarget as HTMLElement;
  const scroller = findScroller(target);
  const startScroll = scroller?.scrollTop ?? 0;
  const basePadding = scroller
    ? Number.parseFloat(window.getComputedStyle(scroller).paddingBottom) || 0
    : 0;
  const originalPadding = scroller?.style.paddingBottom ?? '';
  let pinnedScroll = startScroll;
  let lastY = startY;
  let frame = 0;
  let pinFrame = 0;
  let lastFrame = 0;

  try {
    target.setPointerCapture(event.pointerId);
  } catch {
    /* synthetic pointers */
  }
  document.body.classList.add('note-resizing');

  function updateHeight(): void {
    if (scroller) scroller.scrollTop = pinnedScroll;
    const scrollDelta = (scroller?.scrollTop ?? 0) - startScroll;
    const delta = (lastY - startY + scrollDelta) / scale;
    const next = Math.max(
      NOTE_MIN_HEIGHT,
      Math.min(NOTE_MAX_HEIGHT, Math.round((startHeight + delta) / 10) * 10),
    );
    // A shrinking page would otherwise collapse the stage's scroll range, and
    // the browser would clamp scrollTop as soon as the next frame lands. Keep
    // the range with temporary bottom space so the grip can follow the finger
    // instead of sticking to the viewport bottom.
    if (scroller) {
      const shrink = Math.max(0, (startHeight - next) * scale);
      scroller.style.paddingBottom = `${basePadding + shrink}px`;
    }
    if (next !== props.height) emit('update:height', next);
    if (scroller) {
      // Pin again after Vue has applied the new page height; scroll anchoring
      // must not move the stage underneath the pointer.
      if (pinFrame) cancelAnimationFrame(pinFrame);
      pinFrame = requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = pinnedScroll;
      });
    }
  }

  function tick(now: number): void {
    if (!scroller) return;
    const dt = lastFrame ? Math.min(50, now - lastFrame) : 16;
    lastFrame = now;
    const rect = scroller.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const shrinking = lastY < startY;
    const distance = shrinking ? lastY - top : bottom - lastY;
    const max = scroller.scrollHeight - scroller.clientHeight;

    // Keep the stage still until the pointer reaches an edge. Once inside the
    // edge zone, scroll with a proximity ramp so the grip stays under the
    // pointer and the height keeps changing.
    if (distance < RESIZE_EDGE_PX) {
      const strength = Math.max(0, 1 - Math.max(0, distance) / RESIZE_EDGE_PX);
      const speed = RESIZE_MIN_SPEED + (RESIZE_MAX_SPEED - RESIZE_MIN_SPEED) * strength;
      const before = scroller.scrollTop;
      const next = shrinking
        ? Math.max(0, before - (speed * dt) / 1000)
        : Math.min(max, before + (speed * dt) / 1000);
      if (next !== before) {
        pinnedScroll = next;
        scroller.scrollTop = next;
        updateHeight();
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function move(moveEvent: PointerEvent): void {
    moveEvent.preventDefault();
    lastY = moveEvent.clientY;
    updateHeight();
  }

  function stop(): void {
    cancelAnimationFrame(frame);
    if (pinFrame) cancelAnimationFrame(pinFrame);
    if (scroller) scroller.style.paddingBottom = originalPadding;
    document.body.classList.remove('note-resizing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  frame = requestAnimationFrame(tick);
}

defineExpose({ updateOverflow });
</script>

<template>
  <div class="note-page-frame" :style="frameStyle">
    <div class="note-page" :class="{ 'note-page--sheen': paper.sheen }" :style="innerStyle">
      <div ref="content" class="note-page__content" :style="contentStyle">
        <slot />
      </div>
      <div
        ref="spill"
        class="note-page__content note-page__spill"
        :style="contentStyle"
        aria-hidden="true"
        v-html="mirrorHtml"
      />
      <button
        v-if="editable"
        class="note-page__grip"
        type="button"
        title="Drag to change the page height"
        aria-label="Drag to change the page height"
        @pointerdown="startResize"
      />
    </div>
  </div>
</template>

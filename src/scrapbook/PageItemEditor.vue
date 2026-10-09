<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PageElement } from '@/data/types';
import { usePageEditorStore } from '@/stores/pageEditor';
import { elementStyle } from '@/scrapbook/elementStyle';
import { angleFromCenter, resizeCorner, type Box } from '@/scrapbook/transform';
import PageElementContent from '@/scrapbook/PageElementContent.vue';

const props = defineProps<{ el: PageElement }>();
const pe = usePageEditorStore();

const rootEl = ref<HTMLElement | null>(null);
const selected = computed(() => pe.selectedId === props.el.id);
const bare = computed(() => props.el.kind === 'note' && (props.el.paper ?? 'sticky') === 'none');
const style = computed(() => elementStyle(props.el));
const box = computed<Box>(() => ({
  x: props.el.x,
  y: props.el.y,
  w: props.el.w,
  h: props.el.h,
  rotation: props.el.rotation,
}));

/** Images always keep their aspect in the page editor (crop aspect is set in the image editor). */
const aspectLocked = computed(() => {
  if (props.el.kind === 'image') return true;
  return props.el.aspectLocked !== false;
});

type Mode = 'move' | 'resize' | 'rotate';
const DRAG_THRESHOLD = 3;
let mode: Mode = 'move';
let pid = -1;
let startClient = { x: 0, y: 0 };
let origin: Box = box.value;
let originScale = 1;
let moved = false;
const dragging = ref(false);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function pageRect(): DOMRect | null {
  return rootEl.value?.closest('.square-page')?.getBoundingClientRect() ?? null;
}
function begin(e: PointerEvent, m: Mode) {
  if (e.button !== 0) return;
  e.stopPropagation();
  pe.select(props.el.id);
  if (props.el.locked) return;
  pe.snapshot();
  mode = m;
  pid = e.pointerId;
  startClient = { x: e.clientX, y: e.clientY };
  origin = box.value;
  originScale = props.el.scale ?? 1;
  moved = false;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
function onDown(e: PointerEvent) {
  begin(e, 'move');
}
function onResizeDown(e: PointerEvent) {
  begin(e, 'resize');
}
function onRotateDown(e: PointerEvent) {
  begin(e, 'rotate');
}
function onMove(e: PointerEvent) {
  if (e.pointerId !== pid) return;
  const rect = pageRect();
  if (!rect) return;
  if (mode === 'move') {
    if (!moved) {
      if (Math.abs(e.clientX - startClient.x) < DRAG_THRESHOLD && Math.abs(e.clientY - startClient.y) < DRAG_THRESHOLD) return;
      moved = true;
      dragging.value = true;
    }
    const dx = (e.clientX - startClient.x) / rect.width;
    const dy = (e.clientY - startClient.y) / rect.height;
    pe.updateElement(props.el.id, {
      x: clamp(origin.x + dx, 0, 1),
      y: clamp(origin.y + dy, 0, 1),
    });
    return;
  }
  const p = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  if (mode === 'resize') {
    const nb = resizeCorner(origin, p, { locked: aspectLocked.value });
    // Scaling a note zooms the whole thing (identical, just bigger) — font untouched.
    if (props.el.kind === 'note') {
      const k = origin.w > 0 ? nb.w / origin.w : 1;
      pe.updateElement(props.el.id, { scale: Math.min(5, Math.max(0.2, originScale * k)) });
    } else {
      pe.updateElement(props.el.id, { x: nb.x, y: nb.y, w: nb.w, h: nb.h });
    }
  } else {
    pe.updateElement(props.el.id, { rotation: angleFromCenter({ x: origin.x, y: origin.y }, p) });
  }
}
function onUp(e: PointerEvent) {
  if (e.pointerId !== pid) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  pid = -1;
  moved = false;
  dragging.value = false;
}
function onDoubleClick() {
  if (props.el.kind === 'image') pe.openImageEditor(props.el.id);
  else if (props.el.kind === 'note') pe.openNoteEditor(props.el.id);
}
</script>

<template>
  <div
    ref="rootEl"
    class="el el--editable"
    :class="{ 'el--selected': selected, 'el--dragging': dragging, 'el--locked': el.locked, 'el--note-bare': bare }"
    :style="style"
    @pointerdown="onDown"
    @dblclick="onDoubleClick"
    @dragstart.prevent
  >
    <PageElementContent :el="el" />
    <template v-if="selected && !el.locked">
      <span class="pe-handle pe-handle--br" title="Resize" @pointerdown="onResizeDown"></span>
      <span class="pe-rot" title="Rotate" @pointerdown="onRotateDown"></span>
    </template>
    <span v-if="el.locked" class="pe-lock icon icon--lock" aria-hidden="true"></span>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { NoteElement } from '@/data/types';
import { usePageEditorStore } from '@/stores/pageEditor';
import { useViewport } from '@/composables/useViewport';
import { paperById } from '@/scrapbook/paper';
import { INK_COLORS, NOTE_PAPER_COLORS, NOTE_PAPERS, PENS, notePaperById } from '@/scrapbook/notes';
import PageElementContent from '@/scrapbook/PageElementContent.vue';

const pe = usePageEditorStore();
const { width, height } = useViewport();

const el = computed<NoteElement | null>(() => {
  const e = pe.editingNote;
  return e && e.kind === 'note' ? e : null;
});
const paper = computed(() => notePaperById(el.value?.paper ?? 'sticky'));
const bare = computed(() => (el.value?.paper ?? 'sticky') === 'none');

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const stageStyle = computed(() => ({ background: rgba(paperById(pe.background).color, 0.85) }));

const LOGICAL = 480;
const availW = computed(() => Math.max(120, width.value - 340 - 48));
const availH = computed(() => Math.max(120, height.value - 48));
// Fit the whole (square) page, so the note is shown exactly as on the page.
const previewScale = computed(() => Math.min(availW.value, availH.value) / LOGICAL);
const logicalW = computed(() => Math.max(24, (el.value?.w ?? 0.5) * LOGICAL));
const logicalH = computed(() => Math.max(24, (el.value?.h ?? 0.2) * LOGICAL));
const effScale = computed(() => previewScale.value * (el.value?.scale ?? 1));
const boxStyle = computed(() =>
  bare.value
    ? { width: `${logicalW.value}px`, transform: `scale(${effScale.value})` }
    : { width: `${logicalW.value}px`, height: `${logicalH.value}px`, transform: `scale(${effScale.value})` },
);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function set(patch: Parameters<typeof pe.updateElement>[1]) {
  if (el.value) {
    pe.snapshot();
    pe.updateElement(el.value.id, patch);
  }
}
function num(v: string) {
  return Number(v);
}
function setScale(value: number) {
  if (el.value) pe.updateElement(el.value.id, { scale: clamp(value, 0.2, 5) });
}

// height handle (vertical only)
let rid = -1;
let rStart = { x: 0, y: 0 };
let rOriginH = 0.2;
function onResizeDown(e: PointerEvent) {
  if (e.button !== 0 || !el.value) return;
  e.stopPropagation();
  pe.snapshot();
  rid = e.pointerId;
  rStart = { x: e.clientX, y: e.clientY };
  rOriginH = el.value.h;
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeUp);
  window.addEventListener('pointercancel', onResizeUp);
}
function onResizeMove(e: PointerEvent) {
  if (e.pointerId !== rid || !el.value) return;
  const s = previewScale.value || 1;
  const dH = (e.clientY - rStart.y) / (LOGICAL * s);
  pe.updateElement(el.value.id, { h: clamp(rOriginH + dH, 0.06, 2) });
}
function onResizeUp(e: PointerEvent) {
  if (e.pointerId !== rid) return;
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeUp);
  window.removeEventListener('pointercancel', onResizeUp);
  rid = -1;
}

// overall scale via wheel / pinch
function onWheel(e: WheelEvent) {
  const e0 = el.value;
  if (!e0) return;
  e.preventDefault();
  setScale((e0.scale ?? 1) * (1 - e.deltaY * 0.0015));
}
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart = 0;
let pinchScale = 1;
function pinchDist(): number {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function onPointerDown(e: PointerEvent) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    pinchStart = pinchDist();
    pinchScale = el.value?.scale ?? 1;
    pe.snapshot();
  }
}
function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinchStart > 0) setScale(pinchScale * (pinchDist() / pinchStart));
}
function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = 0;
}

const writeEl = ref<HTMLTextAreaElement | null>(null);
onMounted(() => nextTick(() => writeEl.value?.focus()));
function onInput(e: Event) {
  if (el.value) pe.updateElement(el.value.id, { text: (e.target as HTMLTextAreaElement).value });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="el" class="imgedit noteedit">
      <div
        class="imgedit-stage note-stage"
        :style="stageStyle"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="note-box" :style="boxStyle">
          <div class="el el--static" :class="{ 'el--note-bare': bare }">
            <PageElementContent :el="el" />
          </div>
          <span v-if="!bare" class="note-handle" title="Drag to resize height" @pointerdown="onResizeDown"></span>
        </div>
      </div>

      <aside class="editor editor--right imgedit-panel">
        <header class="editor__head">
          <h2>Edit note</h2>
          <button class="btn btn--small btn--primary" type="button" @click="pe.closeNoteEditor()">Done</button>
        </header>
        <div class="editor__body">
          <section>
            <label>Write</label>
            <textarea
              ref="writeEl"
              class="text-input"
              :value="el.text"
              rows="4"
              spellcheck="false"
              @focus="pe.snapshot()"
              @input="onInput"
            ></textarea>
          </section>

          <section>
            <label>Pen</label>
            <div class="pen-row">
              <button
                v-for="p in PENS"
                :key="p.id"
                class="pen-chip"
                :class="{ 'is-active': (el.font ?? 'pen') === p.id }"
                type="button"
                :title="p.label"
                @click="set({ font: p.id })"
              >
                <span :style="{ fontFamily: p.family, fontWeight: String(p.weight), fontStyle: p.italic ? 'italic' : 'normal' }">Aa</span>
                <span class="pen-chip__label">{{ p.label }}</span>
              </button>
            </div>
          </section>

          <section>
            <label>Font size</label>
            <div class="field">
              <span>{{ Math.round(el.size ?? 18) }}px</span>
              <input type="range" min="6" max="120" step="1" :value="el.size ?? 18" @pointerdown="pe.snapshot()" @input="pe.updateElement(el.id, { size: num(($event.target as HTMLInputElement).value) })" />
              <input type="number" min="6" max="120" step="1" :value="el.size ?? 18" @change="set({ size: num(($event.target as HTMLInputElement).value) })" />
            </div>
            <div class="field">
              <span>Line</span>
              <input type="range" min="1" max="2.2" step="0.05" :value="el.lineHeight ?? 1.3" @pointerdown="pe.snapshot()" @input="pe.updateElement(el.id, { lineHeight: num(($event.target as HTMLInputElement).value) })" />
            </div>
          </section>

          <section>
            <label>Ink</label>
            <div class="swatches">
              <button v-for="c in INK_COLORS" :key="c" class="swatch" :style="{ background: c }" type="button" @click="set({ ink: c })"></button>
              <input type="color" :value="el.ink ?? '#4a3b2e'" @input="pe.updateElement(el.id, { ink: ($event.target as HTMLInputElement).value })" />
            </div>
          </section>

          <section>
            <label>Paper</label>
            <div class="chip-row">
              <button
                v-for="p in NOTE_PAPERS"
                :key="p.id"
                class="chip chip--wide"
                :class="{ 'is-active': (el.paper ?? 'sticky') === p.id }"
                type="button"
                @click="set({ paper: p.id })"
              >
                {{ p.label }}
              </button>
            </div>
            <div v-if="paper.colorable" class="swatches" style="margin-top: 0.35rem">
              <button v-for="c in NOTE_PAPER_COLORS" :key="c" class="swatch" :style="{ background: c }" type="button" @click="set({ color: c })"></button>
              <input type="color" :value="el.color ?? paper.bg" @input="pe.updateElement(el.id, { color: ($event.target as HTMLInputElement).value })" />
            </div>
          </section>

          <section>
            <label>Effects</label>
            <div class="editor__row">
              <button class="btn btn--small" :class="{ 'btn--primary': el.bold }" type="button" @click="set({ bold: !el.bold })">Bold</button>
              <button class="btn btn--small" :class="{ 'btn--primary': el.italic }" type="button" @click="set({ italic: !el.italic })">Italic</button>
              <button class="btn btn--small" :class="{ 'btn--primary': el.uppercase }" type="button" @click="set({ uppercase: !el.uppercase })">UPPER</button>
              <button class="btn btn--small" :class="{ 'btn--primary': el.shadow }" type="button" @click="set({ shadow: !el.shadow })">Shadow</button>
            </div>
            <div class="editor__row" style="margin-top: 0.4rem">
              <button class="btn btn--small" :class="{ 'btn--primary': (el.align ?? 'center') === 'left' }" type="button" @click="set({ align: 'left' })">Left</button>
              <button class="btn btn--small" :class="{ 'btn--primary': (el.align ?? 'center') === 'center' }" type="button" @click="set({ align: 'center' })">Center</button>
              <button class="btn btn--small" :class="{ 'btn--primary': (el.align ?? 'center') === 'right' }" type="button" @click="set({ align: 'right' })">Right</button>
            </div>
            <div class="editor__row" style="margin-top: 0.4rem">
              <button class="btn btn--small" :class="{ 'btn--primary': (el.valign ?? 'middle') === 'top' }" type="button" @click="set({ valign: 'top' })">Top</button>
              <button class="btn btn--small" :class="{ 'btn--primary': (el.valign ?? 'middle') === 'middle' }" type="button" @click="set({ valign: 'middle' })">Middle</button>
              <button class="btn btn--small" :class="{ 'btn--primary': (el.valign ?? 'middle') === 'bottom' }" type="button" @click="set({ valign: 'bottom' })">Bottom</button>
            </div>
          </section>

          <section>
            <label>Paper size</label>
            <div v-if="!bare" class="field">
              <span>Height</span>
              <input type="range" min="0.06" max="2" step="0.005" :value="el.h" @pointerdown="pe.snapshot()" @input="pe.updateElement(el.id, { h: num(($event.target as HTMLInputElement).value) })" />
            </div>
            <p v-if="bare" class="editor__muted">No paper — the note hugs its text.</p>
          </section>

          <section>
            <label>Overall scale</label>
            <div class="field">
              <span>{{ Math.round((el.scale ?? 1) * 100) }}%</span>
              <input type="range" min="0.2" max="5" step="0.01" :value="el.scale ?? 1" @pointerdown="pe.snapshot()" @input="setScale(num(($event.target as HTMLInputElement).value))" />
              <input type="number" min="0.2" max="5" step="0.05" :value="el.scale ?? 1" @change="setScale(num(($event.target as HTMLInputElement).value))" />
            </div>
            <p class="editor__muted">Scroll or pinch the note to scale it — looks identical, just bigger.</p>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
